import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useRetrospectiveStore } from '../hooks/useRetrospectiveStore';
import { ParticipantRole } from '../types';
import type { Participant } from '../types';

export const ParticipantBar: React.FC = () => {
  const participants = useRetrospectiveStore((s) => s.participants);
  const retrospective = useRetrospectiveStore((s) => s.retrospective);

  const onlineCount = participants.filter((p) => p.isOnline).length;

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-slate-800/30 border-b border-slate-700/50">
      {/* Presence Indicator */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping opacity-75" />
        </div>
        <span className="text-sm text-slate-300">
          <span className="font-medium text-white">{onlineCount}</span>
          {' '}viewing
        </span>
      </div>

      {/* Participant Avatars */}
      <div className="flex items-center -space-x-2">
        <AnimatePresence>
          {participants.slice(0, 8).map((participant, index) => (
            <ParticipantAvatar
              key={participant.userId}
              participant={participant}
              index={index}
            />
          ))}
        </AnimatePresence>
        {participants.length > 8 && (
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-700 border-2 border-slate-800 text-xs font-medium text-slate-300 z-10">
            +{participants.length - 8}
          </div>
        )}
      </div>

      {/* Facilitator Badge */}
      {retrospective && (
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-slate-400">Facilitator:</span>
          <span className="text-white font-medium">
            {participants.find((p) => p.role === ParticipantRole.FACILITATOR)?.displayName || 'Unknown'}
          </span>
        </div>
      )}
    </div>
  );
};

interface ParticipantAvatarProps {
  participant: Participant;
  index: number;
}

const ParticipantAvatar: React.FC<ParticipantAvatarProps> = ({ participant, index }) => {
  const initials = participant.displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const colors = [
    'bg-vendasta-500',
    'bg-accent-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-lime-500',
    'bg-amber-500',
    'bg-orange-500',
  ];

  const colorClass = colors[index % colors.length];

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ delay: index * 0.05 }}
      className="relative group"
      style={{ zIndex: 10 - index }}
    >
      {participant.avatarUrl ? (
        <img
          src={participant.avatarUrl}
          alt={participant.displayName}
          className={clsx(
            'w-8 h-8 rounded-full border-2 border-slate-800',
            !participant.isOnline && 'opacity-50 grayscale'
          )}
        />
      ) : (
        <div
          className={clsx(
            'w-8 h-8 rounded-full border-2 border-slate-800 flex items-center justify-center text-xs font-medium text-white',
            colorClass,
            !participant.isOnline && 'opacity-50'
          )}
        >
          {initials}
        </div>
      )}

      {/* Role Badge */}
      {participant.role === ParticipantRole.FACILITATOR && (
        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center text-[10px]">
          ⭐
        </div>
      )}

      {/* Online Indicator */}
      {participant.isOnline && (
        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-slate-800" />
      )}

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        {participant.displayName}
        {participant.role === ParticipantRole.FACILITATOR && ' (Facilitator)'}
      </div>
    </motion.div>
  );
};

export default ParticipantBar;
