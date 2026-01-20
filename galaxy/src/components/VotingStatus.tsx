import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { useRetrospectiveStore } from '../hooks/useRetrospectiveStore';
import { RetrospectiveStatus } from '../types';

export const VotingStatus: React.FC = () => {
  const retrospective = useRetrospectiveStore((s) => s.retrospective);
  const userVotes = useRetrospectiveStore((s) => s.userVotes);

  if (!retrospective || retrospective.status !== RetrospectiveStatus.VOTING) {
    return null;
  }

  const maxVotes = retrospective.votingConfig?.maxVotesPerUser || 5;
  const votesUsed = userVotes?.votesCast || 0;
  const votesRemaining = userVotes?.votesRemaining || maxVotes;
  const percentage = (votesUsed / maxVotes) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-4 right-4 z-50"
    >
      <div className="bg-slate-800/95 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50 shadow-xl min-w-[200px]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-white">Your Votes</span>
          <span className="text-2xl">🗳️</span>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={clsx(
              'h-full rounded-full',
              votesRemaining === 0
                ? 'bg-red-500'
                : votesRemaining <= 2
                ? 'bg-yellow-500'
                : 'bg-vendasta-500'
            )}
          />
        </div>

        {/* Vote Count */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">
            {votesUsed} of {maxVotes} used
          </span>
          <span
            className={clsx(
              'font-bold',
              votesRemaining === 0
                ? 'text-red-400'
                : votesRemaining <= 2
                ? 'text-yellow-400'
                : 'text-green-400'
            )}
          >
            {votesRemaining} left
          </span>
        </div>

        {/* Vote Indicators */}
        <div className="flex items-center justify-center gap-1 mt-3">
          {Array.from({ length: maxVotes }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className={clsx(
                'w-6 h-6 rounded-full flex items-center justify-center text-sm',
                i < votesUsed
                  ? 'bg-vendasta-500 text-white'
                  : 'bg-slate-700 text-slate-500'
              )}
            >
              {i < votesUsed ? '✓' : '○'}
            </motion.div>
          ))}
        </div>

        {votesRemaining === 0 && (
          <p className="text-xs text-center text-slate-400 mt-3">
            Remove a vote to vote for something else
          </p>
        )}
      </div>
    </motion.div>
  );
};

export default VotingStatus;
