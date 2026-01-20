import React, { useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { useRetrospectiveStore } from '../hooks/useRetrospectiveStore';
import { retrospectiveService, itemService, votingService, realtimeService, actionItemService } from '../services/api';
import { RetroBoard } from '../components/RetroBoard';
import { ParticipantBar } from '../components/ParticipantBar';
import { VotingStatus } from '../components/VotingStatus';
import { ActionItemsList } from '../components/ActionItemsList';
import { RetrospectiveStatus, TemplateType } from '../types';

interface RetrospectivePageProps {
  retrospectiveId: string;
}

export const RetrospectivePage: React.FC<RetrospectivePageProps> = ({ retrospectiveId }) => {
  const {
    retrospective,
    setRetrospective,
    setItems,
    setActionItems,
    setParticipants,
    setUserVotes,
    setLoading,
    setError,
    isLoading,
    error,
  } = useRetrospectiveStore();

  // Load retrospective data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Load retrospective with items and action items
        const { retrospective: retro, items, actionItems } = await retrospectiveService.get(
          retrospectiveId,
          { includeItems: true, includeActionItems: true }
        );
        setRetrospective(retro);
        setItems(items || []);
        setActionItems(actionItems || []);

        // Join the retrospective session
        const { presence } = await realtimeService.join(
          retrospectiveId,
          'Current User', // In production, get from auth context
          undefined
        );
        setParticipants(presence.participants);

        // Get user votes if in voting phase
        if (retro.status === RetrospectiveStatus.VOTING) {
          const { summary } = await votingService.getUserVotes(retrospectiveId);
          setUserVotes(summary);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load retrospective');
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Cleanup: leave retrospective on unmount
    return () => {
      realtimeService.leave(retrospectiveId).catch(console.error);
    };
  }, [retrospectiveId]);

  // Heartbeat for presence
  useEffect(() => {
    if (!retrospective) return;

    const interval = setInterval(() => {
      realtimeService.heartbeat(retrospectiveId).catch(console.error);
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [retrospectiveId, retrospective]);

  const handleStatusTransition = useCallback(async (action: 'startVoting' | 'startDiscussion' | 'complete') => {
    try {
      switch (action) {
        case 'startVoting':
          await retrospectiveService.startVoting(retrospectiveId);
          setRetrospective({ ...retrospective!, status: RetrospectiveStatus.VOTING });
          // Load user votes
          const { summary } = await votingService.getUserVotes(retrospectiveId);
          setUserVotes(summary);
          break;
        case 'startDiscussion':
          await retrospectiveService.startDiscussion(retrospectiveId);
          setRetrospective({ ...retrospective!, status: RetrospectiveStatus.DISCUSSING });
          break;
        case 'complete':
          await retrospectiveService.complete(retrospectiveId);
          setRetrospective({ ...retrospective!, status: RetrospectiveStatus.COMPLETED });
          break;
      }
    } catch (err) {
      console.error('Status transition failed:', err);
    }
  }, [retrospectiveId, retrospective, setRetrospective, setUserVotes]);

  const handleExport = useCallback(async (format: 'markdown' | 'csv' | 'json') => {
    try {
      const blob = await retrospectiveService.export(retrospectiveId, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${retrospective?.sprintName || 'retro'}.${format === 'markdown' ? 'md' : format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, [retrospectiveId, retrospective]);

  if (isLoading) {
    return (
      <div className="min-h-screen vendasta-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-vendasta-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading retrospective...</p>
        </div>
      </div>
    );
  }

  if (error || !retrospective) {
    return (
      <div className="min-h-screen vendasta-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <span className="text-4xl mb-4 block">😕</span>
          <p className="text-red-400">{error || 'Retrospective not found'}</p>
        </div>
      </div>
    );
  }

  const statusConfig: Record<RetrospectiveStatus, { label: string; color: string; icon: string }> = {
    [RetrospectiveStatus.UNSPECIFIED]: { label: 'Unknown', color: 'slate', icon: '❓' },
    [RetrospectiveStatus.DRAFT]: { label: 'Draft', color: 'slate', icon: '📝' },
    [RetrospectiveStatus.ACTIVE]: { label: 'Collecting Ideas', color: 'vendasta', icon: '💡' },
    [RetrospectiveStatus.VOTING]: { label: 'Voting', color: 'amber', icon: '🗳️' },
    [RetrospectiveStatus.DISCUSSING]: { label: 'Discussing', color: 'yellow', icon: '💬' },
    [RetrospectiveStatus.COMPLETED]: { label: 'Completed', color: 'accent', icon: '✅' },
  };

  const currentStatus = statusConfig[retrospective.status] || statusConfig[RetrospectiveStatus.UNSPECIFIED];

  return (
    <div className="min-h-screen vendasta-gradient-subtle">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-sm border-b border-vendasta-900/50">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <span className="text-3xl">🔄</span>
                {retrospective.sprintName}
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                {retrospective.teamName} • {retrospective.description}
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Status Badge */}
              <div
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-full font-medium',
                  currentStatus.color === 'vendasta' && 'bg-vendasta-500/20 text-vendasta-400',
                  currentStatus.color === 'amber' && 'bg-amber-500/20 text-amber-400',
                  currentStatus.color === 'yellow' && 'bg-yellow-500/20 text-yellow-400',
                  currentStatus.color === 'accent' && 'bg-accent-500/20 text-accent-400',
                  currentStatus.color === 'slate' && 'bg-slate-500/20 text-slate-400'
                )}
              >
                <span>{currentStatus.icon}</span>
                {currentStatus.label}
              </div>

              {/* Action Buttons */}
              {retrospective.status === RetrospectiveStatus.ACTIVE && (
                <button
                  onClick={() => handleStatusTransition('startVoting')}
                  className="px-4 py-2 bg-vendasta-500 text-white rounded-lg hover:bg-vendasta-400 transition-colors font-medium shadow-lg shadow-vendasta-500/25"
                >
                  Start Voting →
                </button>
              )}
              {retrospective.status === RetrospectiveStatus.VOTING && (
                <button
                  onClick={() => handleStatusTransition('startDiscussion')}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-500 transition-colors font-medium"
                >
                  Start Discussion →
                </button>
              )}
              {retrospective.status === RetrospectiveStatus.DISCUSSING && (
                <button
                  onClick={() => handleStatusTransition('complete')}
                  className="px-4 py-2 bg-vendasta-500 text-white rounded-lg hover:bg-vendasta-400 transition-colors font-medium"
                >
                  Complete Retro ✓
                </button>
              )}

              {/* Export Menu */}
              {retrospective.status === RetrospectiveStatus.COMPLETED && (
                <div className="relative group">
                  <button className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors font-medium">
                    Export ↓
                  </button>
                  <div className="absolute right-0 mt-2 w-40 bg-slate-800 rounded-lg shadow-xl border border-slate-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <button
                      onClick={() => handleExport('markdown')}
                      className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 rounded-t-lg"
                    >
                      📄 Markdown
                    </button>
                    <button
                      onClick={() => handleExport('csv')}
                      className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700"
                    >
                      📊 CSV
                    </button>
                    <button
                      onClick={() => handleExport('json')}
                      className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 rounded-b-lg"
                    >
                      🔧 JSON
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Participant Bar */}
        <ParticipantBar />
      </header>

      {/* Main Content */}
      <main className="pb-8">
        {/* Voting Status Overlay */}
        {retrospective.status === RetrospectiveStatus.VOTING && <VotingStatus />}

        {/* Board */}
        <RetroBoard retrospectiveId={retrospectiveId} />

        {/* Action Items Section */}
        {(retrospective.status === RetrospectiveStatus.DISCUSSING ||
          retrospective.status === RetrospectiveStatus.COMPLETED) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 px-6"
          >
            <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/50">
              <ActionItemsList teamId={retrospective.teamId} />
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default RetrospectivePage;
