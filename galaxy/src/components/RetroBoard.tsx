import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useRetrospectiveStore, useItemsByColumn } from '../hooks/useRetrospectiveStore';
import { itemService, votingService } from '../services/api';
import { RetrospectiveStatus } from '../types';
import type { RetrospectiveItem, TemplateColumn } from '../types';

interface RetroBoardProps {
  retrospectiveId: string;
}

export const RetroBoard: React.FC<RetroBoardProps> = ({ retrospectiveId }) => {
  const retrospective = useRetrospectiveStore((s) => s.retrospective);
  const columns = retrospective?.template?.columns || [];

  if (!retrospective) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="flex gap-4 p-4 overflow-x-auto min-h-[600px]">
      {columns
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((column) => (
          <BoardColumn
            key={column.columnId}
            column={column}
            retrospectiveId={retrospectiveId}
            status={retrospective.status}
          />
        ))}
    </div>
  );
};

interface BoardColumnProps {
  column: TemplateColumn;
  retrospectiveId: string;
  status: RetrospectiveStatus;
}

const BoardColumn: React.FC<BoardColumnProps> = ({ column, retrospectiveId, status }) => {
  const items = useItemsByColumn(column.columnId);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemContent, setNewItemContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const addItem = useRetrospectiveStore((s) => s.addItem);

  const canAddItems = status === RetrospectiveStatus.ACTIVE || status === RetrospectiveStatus.DRAFT;
  const isVotingPhase = status === RetrospectiveStatus.VOTING;

  const handleAddItem = useCallback(async () => {
    if (!newItemContent.trim()) return;

    try {
      const { item } = await itemService.create({
        retrospectiveId,
        columnId: column.columnId,
        content: newItemContent.trim(),
        isAnonymous,
      });
      addItem(item);
      setNewItemContent('');
      setIsAddingItem(false);
    } catch (error) {
      console.error('Failed to add item:', error);
    }
  }, [retrospectiveId, column.columnId, newItemContent, isAnonymous, addItem]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddItem();
    }
    if (e.key === 'Escape') {
      setIsAddingItem(false);
      setNewItemContent('');
    }
  };

  // Sort items by vote count in voting/discussing phase
  const sortedItems = isVotingPhase || status === RetrospectiveStatus.DISCUSSING
    ? [...items].sort((a, b) => b.voteCount - a.voteCount)
    : items;

  return (
    <div className="flex-shrink-0 w-80 bg-slate-800/50 rounded-xl p-4 backdrop-blur-sm border border-slate-700/50">
      {/* Column Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">{column.icon}</span>
        <h3 className="font-semibold text-lg text-white">{column.name}</h3>
        <span className="ml-auto text-sm text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>
      <p className="text-sm text-slate-400 mb-4">{column.description}</p>

      {/* Items */}
      <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto">
        <AnimatePresence>
          {sortedItems.map((item, index) => (
            <BoardItem
              key={item.itemId}
              item={item}
              retrospectiveId={retrospectiveId}
              isVotingPhase={isVotingPhase}
              rank={isVotingPhase ? index + 1 : undefined}
              columnColor={column.color}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Add Item */}
      {canAddItems && (
        <div className="mt-auto">
          {isAddingItem ? (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2"
            >
              <textarea
                autoFocus
                value={newItemContent}
                onChange={(e) => setNewItemContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your thought..."
                className="w-full p-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-vendasta-500"
                rows={3}
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-700"
                  />
                  Anonymous
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setIsAddingItem(false);
                      setNewItemContent('');
                    }}
                    className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddItem}
                    disabled={!newItemContent.trim()}
                    className="px-3 py-1.5 text-sm bg-vendasta-500 text-white rounded-lg hover:bg-vendasta-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <button
              onClick={() => setIsAddingItem(true)}
              className="w-full p-3 border-2 border-dashed border-slate-600 rounded-lg text-slate-400 hover:border-slate-500 hover:text-slate-300 transition-colors"
            >
              + Add item
            </button>
          )}
        </div>
      )}
    </div>
  );
};

interface BoardItemProps {
  item: RetrospectiveItem;
  retrospectiveId: string;
  isVotingPhase: boolean;
  rank?: number;
  columnColor: string;
}

const BoardItem: React.FC<BoardItemProps> = ({
  item,
  retrospectiveId,
  isVotingPhase,
  rank,
  columnColor,
}) => {
  const [isVoting, setIsVoting] = useState(false);
  const userVotes = useRetrospectiveStore((s) => s.userVotes);
  const updateItemVoteCount = useRetrospectiveStore((s) => s.updateItemVoteCount);
  const setUserVotes = useRetrospectiveStore((s) => s.setUserVotes);

  const hasVoted = userVotes?.votedItemIds.includes(item.itemId) || false;
  const canVote = isVotingPhase && (userVotes?.votesRemaining || 0) > 0;

  const handleVote = async () => {
    if (isVoting) return;
    setIsVoting(true);

    try {
      if (hasVoted) {
        await votingService.removeVote(retrospectiveId, item.itemId);
        updateItemVoteCount(item.itemId, item.voteCount - 1);
        if (userVotes) {
          setUserVotes({
            ...userVotes,
            votesCast: userVotes.votesCast - 1,
            votesRemaining: userVotes.votesRemaining + 1,
            votedItemIds: userVotes.votedItemIds.filter((id) => id !== item.itemId),
          });
        }
      } else if (canVote) {
        await votingService.castVote(retrospectiveId, item.itemId);
        updateItemVoteCount(item.itemId, item.voteCount + 1);
        if (userVotes) {
          setUserVotes({
            ...userVotes,
            votesCast: userVotes.votesCast + 1,
            votesRemaining: userVotes.votesRemaining - 1,
            votedItemIds: [...userVotes.votedItemIds, item.itemId],
          });
        }
      }
    } catch (error) {
      console.error('Vote failed:', error);
    } finally {
      setIsVoting(false);
    }
  };

  const isTopItem = rank && rank <= 3;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={clsx(
        'p-3 bg-slate-700/70 rounded-lg border transition-all',
        isTopItem && 'ring-2',
        rank === 1 && 'ring-yellow-500/50 bg-yellow-500/10',
        rank === 2 && 'ring-slate-400/50 bg-slate-400/10',
        rank === 3 && 'ring-amber-600/50 bg-amber-600/10',
        !isTopItem && 'border-slate-600/50 hover:border-slate-500'
      )}
      style={{ borderLeftColor: columnColor, borderLeftWidth: 3 }}
    >
      {/* Rank Badge */}
      {isTopItem && (
        <div className="flex items-center gap-1 mb-2">
          <span className={clsx(
            'text-xs font-bold px-2 py-0.5 rounded-full',
            rank === 1 && 'bg-yellow-500 text-yellow-900',
            rank === 2 && 'bg-slate-400 text-slate-900',
            rank === 3 && 'bg-amber-600 text-amber-100'
          )}>
            #{rank}
          </span>
        </div>
      )}

      {/* Content */}
      <p className="text-white text-sm whitespace-pre-wrap">{item.content}</p>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-600/50">
        <span className="text-xs text-slate-400">
          {item.isAnonymous ? 'Anonymous' : item.createdByName}
        </span>

        {/* Vote Button */}
        {isVotingPhase && (
          <button
            onClick={handleVote}
            disabled={isVoting || (!hasVoted && !canVote)}
            className={clsx(
              'flex items-center gap-1.5 px-2 py-1 rounded-full text-sm font-medium transition-all',
              hasVoted
                ? 'bg-vendasta-500 text-white hover:bg-vendasta-400'
                : canVote
                ? 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            )}
          >
            <span>👍</span>
            <span>{item.voteCount}</span>
          </button>
        )}

        {!isVotingPhase && item.voteCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <span>👍</span>
            <span>{item.voteCount}</span>
          </span>
        )}
      </div>
    </motion.div>
  );
};

export default RetroBoard;
