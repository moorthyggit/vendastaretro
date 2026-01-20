import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { useRetrospectiveStore } from '../hooks/useRetrospectiveStore';
import { actionItemService } from '../services/api';
import type { ActionItem, ActionItemStatus, ActionItemPriority } from '../types';

interface ActionItemsListProps {
  teamId: string;
  showCreateButton?: boolean;
}

export const ActionItemsList: React.FC<ActionItemsListProps> = ({
  teamId,
  showCreateButton = true,
}) => {
  const actionItems = useRetrospectiveStore((s) => s.actionItems);
  const [isCreating, setIsCreating] = useState(false);

  const groupedByStatus = actionItems.reduce(
    (acc, item) => {
      const status = item.status || ActionItemStatus.NOT_STARTED;
      if (!acc[status]) acc[status] = [];
      acc[status].push(item);
      return acc;
    },
    {} as Record<ActionItemStatus, ActionItem[]>
  );

  const statusOrder = [
    ActionItemStatus.IN_PROGRESS,
    ActionItemStatus.NOT_STARTED,
    ActionItemStatus.DONE,
    ActionItemStatus.WONT_DO,
  ];

  const statusConfig: Record<
    ActionItemStatus,
    { label: string; icon: string; color: string }
  > = {
    [ActionItemStatus.UNSPECIFIED]: { label: 'Unknown', icon: '❓', color: 'slate' },
    [ActionItemStatus.NOT_STARTED]: { label: 'Not Started', icon: '⬜', color: 'slate' },
    [ActionItemStatus.IN_PROGRESS]: { label: 'In Progress', icon: '🔄', color: 'vendasta' },
    [ActionItemStatus.DONE]: { label: 'Done', icon: '✅', color: 'green' },
    [ActionItemStatus.WONT_DO]: { label: "Won't Do", icon: '❌', color: 'red' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <span>📋</span>
          Action Items
          <span className="text-sm font-normal text-slate-400">
            ({actionItems.length})
          </span>
        </h2>
        {showCreateButton && (
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-vendasta-500 text-white rounded-lg hover:bg-vendasta-400 transition-colors text-sm font-medium"
          >
            + New Action Item
          </button>
        )}
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {isCreating && (
          <CreateActionItemForm
            teamId={teamId}
            onClose={() => setIsCreating(false)}
          />
        )}
      </AnimatePresence>

      {/* Action Items by Status */}
      <div className="space-y-6">
        {statusOrder.map((status) => {
          const items = groupedByStatus[status] || [];
          if (items.length === 0) return null;

          const config = statusConfig[status];

          return (
            <div key={status}>
              <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                <span>{config.icon}</span>
                {config.label}
                <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full">
                  {items.length}
                </span>
              </h3>
              <div className="space-y-2">
                <AnimatePresence>
                  {items.map((item) => (
                    <ActionItemCard key={item.actionItemId} item={item} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {actionItems.length === 0 && (
        <div className="text-center py-12">
          <span className="text-4xl mb-4 block">📝</span>
          <p className="text-slate-400">No action items yet</p>
          <p className="text-sm text-slate-500 mt-1">
            Create action items from retrospective discussions
          </p>
        </div>
      )}
    </div>
  );
};

interface ActionItemCardProps {
  item: ActionItem;
}

const ActionItemCard: React.FC<ActionItemCardProps> = ({ item }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const updateActionItem = useRetrospectiveStore((s) => s.updateActionItem);

  const priorityConfig: Record<
    ActionItemPriority,
    { label: string; color: string }
  > = {
    [ActionItemPriority.UNSPECIFIED]: { label: '', color: 'slate' },
    [ActionItemPriority.LOW]: { label: 'Low', color: 'slate' },
    [ActionItemPriority.MEDIUM]: { label: 'Medium', color: 'yellow' },
    [ActionItemPriority.HIGH]: { label: 'High', color: 'orange' },
    [ActionItemPriority.CRITICAL]: { label: 'Critical', color: 'red' },
  };

  const handleStatusChange = async (newStatus: ActionItemStatus) => {
    setIsUpdating(true);
    try {
      await actionItemService.updateStatus(item.actionItemId, newStatus);
      updateActionItem({ ...item, status: newStatus });
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const priority = priorityConfig[item.priority] || priorityConfig[ActionItemPriority.UNSPECIFIED];
  const isOverdue = item.dueDate && new Date(item.dueDate) < new Date() && item.status !== ActionItemStatus.DONE;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className={clsx(
        'p-4 bg-slate-800/50 rounded-lg border transition-all',
        isOverdue ? 'border-red-500/50' : 'border-slate-700/50',
        item.status === ActionItemStatus.DONE && 'opacity-60'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Status Checkbox */}
        <button
          onClick={() =>
            handleStatusChange(
              item.status === ActionItemStatus.DONE
                ? ActionItemStatus.NOT_STARTED
                : ActionItemStatus.DONE
            )
          }
          disabled={isUpdating}
          className={clsx(
            'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
            item.status === ActionItemStatus.DONE
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-slate-500 hover:border-slate-400'
          )}
        >
          {item.status === ActionItemStatus.DONE && '✓'}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className={clsx(
              'text-white',
              item.status === ActionItemStatus.DONE && 'line-through text-slate-400'
            )}
          >
            {item.description}
          </p>

          {/* Meta */}
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
            {item.assigneeName && (
              <span className="flex items-center gap-1">
                <span>👤</span>
                {item.assigneeName}
              </span>
            )}
            {item.dueDate && (
              <span
                className={clsx(
                  'flex items-center gap-1',
                  isOverdue && 'text-red-400'
                )}
              >
                <span>📅</span>
                {format(new Date(item.dueDate), 'MMM d')}
                {isOverdue && ' (overdue)'}
              </span>
            )}
            {item.sourceSprintName && (
              <span className="flex items-center gap-1">
                <span>🔄</span>
                {item.sourceSprintName}
              </span>
            )}
          </div>
        </div>

        {/* Priority Badge */}
        {item.priority !== ActionItemPriority.UNSPECIFIED && (
          <span
            className={clsx(
              'px-2 py-0.5 rounded text-xs font-medium',
              priority.color === 'red' && 'bg-red-500/20 text-red-400',
              priority.color === 'orange' && 'bg-orange-500/20 text-orange-400',
              priority.color === 'yellow' && 'bg-yellow-500/20 text-yellow-400',
              priority.color === 'slate' && 'bg-slate-500/20 text-slate-400'
            )}
          >
            {priority.label}
          </span>
        )}

        {/* Status Dropdown */}
        <select
          value={item.status}
          onChange={(e) => handleStatusChange(Number(e.target.value))}
          disabled={isUpdating}
          className="bg-slate-700 text-slate-300 text-xs rounded px-2 py-1 border border-slate-600"
        >
          <option value={ActionItemStatus.NOT_STARTED}>Not Started</option>
          <option value={ActionItemStatus.IN_PROGRESS}>In Progress</option>
          <option value={ActionItemStatus.DONE}>Done</option>
          <option value={ActionItemStatus.WONT_DO}>Won't Do</option>
        </select>
      </div>
    </motion.div>
  );
};

interface CreateActionItemFormProps {
  teamId: string;
  onClose: () => void;
}

const CreateActionItemForm: React.FC<CreateActionItemFormProps> = ({
  teamId,
  onClose,
}) => {
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<ActionItemPriority>(ActionItemPriority.MEDIUM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const addActionItem = useRetrospectiveStore((s) => s.addActionItem);
  const retrospective = useRetrospectiveStore((s) => s.retrospective);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setIsSubmitting(true);
    try {
      const { actionItem } = await actionItemService.create({
        teamId,
        retrospectiveId: retrospective?.retrospectiveId,
        description: description.trim(),
        priority,
      });
      addActionItem(actionItem);
      onClose();
    } catch (error) {
      console.error('Failed to create action item:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      onSubmit={handleSubmit}
      className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50 space-y-4"
    >
      <textarea
        autoFocus
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What needs to be done?"
        className="w-full p-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-vendasta-500"
        rows={2}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-400">Priority:</label>
          <select
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="bg-slate-700 text-slate-300 text-sm rounded px-2 py-1 border border-slate-600"
          >
            <option value={ActionItemPriority.LOW}>Low</option>
            <option value={ActionItemPriority.MEDIUM}>Medium</option>
            <option value={ActionItemPriority.HIGH}>High</option>
            <option value={ActionItemPriority.CRITICAL}>Critical</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!description.trim() || isSubmitting}
            className="px-4 py-1.5 text-sm bg-vendasta-500 text-white rounded-lg hover:bg-vendasta-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </motion.form>
  );
};

export default ActionItemsList;
