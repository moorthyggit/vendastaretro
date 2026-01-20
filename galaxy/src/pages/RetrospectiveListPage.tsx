import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { retrospectiveService } from '../services/api';
import { RetrospectiveStatus, TemplateType } from '../types';
import type { Retrospective } from '../types';

export const RetrospectiveListPage: React.FC = () => {
  const [retrospectives, setRetrospectives] = useState<Retrospective[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  useEffect(() => {
    const loadRetros = async () => {
      try {
        const { retrospectives: retros } = await retrospectiveService.list();
        setRetrospectives(retros);
      } catch (error) {
        console.error('Failed to load retrospectives:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadRetros();
  }, []);

  const filteredRetros = retrospectives.filter((retro) => {
    if (filter === 'active') {
      return retro.status !== RetrospectiveStatus.COMPLETED;
    }
    if (filter === 'completed') {
      return retro.status === RetrospectiveStatus.COMPLETED;
    }
    return true;
  });

  const statusConfig: Record<RetrospectiveStatus, { label: string; color: string; icon: string }> = {
    [RetrospectiveStatus.UNSPECIFIED]: { label: 'Unknown', color: 'slate', icon: '❓' },
    [RetrospectiveStatus.DRAFT]: { label: 'Draft', color: 'slate', icon: '📝' },
    [RetrospectiveStatus.ACTIVE]: { label: 'Active', color: 'vendasta', icon: '💡' },
    [RetrospectiveStatus.VOTING]: { label: 'Voting', color: 'amber', icon: '🗳️' },
    [RetrospectiveStatus.DISCUSSING]: { label: 'Discussing', color: 'yellow', icon: '💬' },
    [RetrospectiveStatus.COMPLETED]: { label: 'Completed', color: 'accent', icon: '✅' },
  };

  const templateNames: Record<TemplateType, string> = {
    [TemplateType.UNSPECIFIED]: 'Default',
    [TemplateType.WENT_WELL_TO_IMPROVE]: 'What Went Well / To Improve',
    [TemplateType.START_STOP_CONTINUE]: 'Start / Stop / Continue',
    [TemplateType.FOUR_LS]: '4Ls',
    [TemplateType.MAD_SAD_GLAD]: 'Mad / Sad / Glad',
    [TemplateType.CUSTOM]: 'Custom',
  };

  return (
    <div className="min-h-screen vendasta-gradient-subtle">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-sm border-b border-vendasta-900/50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <span className="text-4xl">🔄</span>
                Sprint Retrospectives
              </h1>
              <p className="text-slate-400 mt-1">
                Review past sprints and track continuous improvement
              </p>
            </div>

            <Link
              to="/retros/new"
              className="px-6 py-3 bg-vendasta-500 text-white rounded-xl hover:bg-vendasta-400 transition-all font-medium shadow-lg shadow-vendasta-500/25 hover:shadow-vendasta-500/40"
            >
              + New Retrospective
            </Link>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 mt-6">
            {(['all', 'active', 'completed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  filter === f
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                )}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-vendasta-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredRetros.length === 0 ? (
          <div className="text-center py-20">
            <span className="text-6xl mb-6 block">🔄</span>
            <h2 className="text-2xl font-semibold text-white mb-2">No retrospectives yet</h2>
            <p className="text-slate-400 mb-6">
              Start your first retrospective to begin tracking team improvements
            </p>
            <Link
              to="/retros/new"
              className="inline-flex px-6 py-3 bg-vendasta-500 text-white rounded-xl hover:bg-vendasta-400 transition-all font-medium"
            >
              Create Your First Retro
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredRetros.map((retro, index) => {
                const status = statusConfig[retro.status] || statusConfig[RetrospectiveStatus.UNSPECIFIED];

                return (
                  <motion.div
                    key={retro.retrospectiveId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link
                      to={`/retros/${retro.retrospectiveId}`}
                      className="block bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 hover:border-vendasta-500/50 hover:bg-slate-800/70 transition-all group"
                    >
                    {/* Status Badge */}
                    <div className="flex items-center justify-between mb-4">
                      <span
                        className={clsx(
                          'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium',
                          status.color === 'vendasta' && 'bg-vendasta-500/20 text-vendasta-400',
                          status.color === 'amber' && 'bg-amber-500/20 text-amber-400',
                          status.color === 'yellow' && 'bg-yellow-500/20 text-yellow-400',
                          status.color === 'accent' && 'bg-accent-500/20 text-accent-400',
                          status.color === 'slate' && 'bg-slate-500/20 text-slate-400'
                        )}
                      >
                        <span>{status.icon}</span>
                        {status.label}
                      </span>
                      <span className="text-slate-500 text-xs">
                        {format(new Date(retro.created), 'MMM d, yyyy')}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-xl font-semibold text-white mb-1 group-hover:text-vendasta-400 transition-colors">
                      {retro.sprintName}
                    </h3>
                    <p className="text-sm text-slate-400 mb-4">
                      {retro.teamName}
                    </p>

                    {/* Description */}
                    {retro.description && (
                      <p className="text-sm text-slate-500 mb-4 line-clamp-2">
                        {retro.description}
                      </p>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm text-slate-400 pt-4 border-t border-slate-700/50">
                      <span className="flex items-center gap-1">
                        <span>💡</span>
                        {retro.itemCount} items
                      </span>
                      <span className="flex items-center gap-1">
                        <span>📋</span>
                        {retro.actionItemCount} actions
                      </span>
                      <span className="flex items-center gap-1">
                        <span>👥</span>
                        {retro.participantCount}
                      </span>
                    </div>

                    {/* Template Badge */}
                    <div className="mt-3">
                      <span className="text-xs text-slate-500">
                        {templateNames[retro.template?.type || TemplateType.UNSPECIFIED]}
                      </span>
                    </div>
                    </Link>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
};

export default RetrospectiveListPage;
