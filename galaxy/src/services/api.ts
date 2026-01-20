/**
 * API Service for Retrospective Backend
 * Uses mock data for development, connects to backend in production
 */

import {
  TemplateType,
  RetrospectiveStatus,
  ActionItemStatus,
  ActionItemPriority,
  ParticipantRole,
} from '../types';
import type {
  Retrospective,
  RetrospectiveItem,
  ActionItem,
  VoteSummary,
  UserVoteSummary,
  PresenceInfo,
  VotingConfig,
  Participant,
  Template,
  TemplateColumn,
} from '../types';

// Check if we're in development mode without a backend
const USE_MOCK = true; // Set to false when backend is running

// ============= MOCK DATA =============

const generateId = () => Math.random().toString(36).substring(2, 15);

// Default templates
const defaultTemplates: Record<TemplateType, Template> = {
  [TemplateType.UNSPECIFIED]: {
    type: TemplateType.UNSPECIFIED,
    name: 'Default',
    columns: [],
  },
  [TemplateType.WENT_WELL_TO_IMPROVE]: {
    type: TemplateType.WENT_WELL_TO_IMPROVE,
    name: 'What Went Well / To Improve',
    columns: [
      { columnId: 'went-well', name: 'Went Well', icon: '👍', description: 'What worked well this sprint?', color: '#22c55e', sortOrder: 1 },
      { columnId: 'to-improve', name: 'To Improve', icon: '🔧', description: 'What could be better?', color: '#ef4444', sortOrder: 2 },
      { columnId: 'action-items', name: 'Action Items', icon: '✅', description: 'What will we do about it?', color: '#3b82f6', sortOrder: 3 },
    ],
  },
  [TemplateType.START_STOP_CONTINUE]: {
    type: TemplateType.START_STOP_CONTINUE,
    name: 'Start / Stop / Continue',
    columns: [
      { columnId: 'start', name: 'Start', icon: '🚀', description: 'What should we start doing?', color: '#22c55e', sortOrder: 1 },
      { columnId: 'stop', name: 'Stop', icon: '🛑', description: 'What should we stop doing?', color: '#ef4444', sortOrder: 2 },
      { columnId: 'continue', name: 'Continue', icon: '➡️', description: 'What should we keep doing?', color: '#3b82f6', sortOrder: 3 },
    ],
  },
  [TemplateType.FOUR_LS]: {
    type: TemplateType.FOUR_LS,
    name: '4Ls',
    columns: [
      { columnId: 'liked', name: 'Liked', icon: '❤️', description: 'What did you like?', color: '#ec4899', sortOrder: 1 },
      { columnId: 'learned', name: 'Learned', icon: '📚', description: 'What did you learn?', color: '#8b5cf6', sortOrder: 2 },
      { columnId: 'lacked', name: 'Lacked', icon: '🤔', description: 'What was lacking?', color: '#f59e0b', sortOrder: 3 },
      { columnId: 'longed-for', name: 'Longed For', icon: '✨', description: 'What do you wish for?', color: '#06b6d4', sortOrder: 4 },
    ],
  },
  [TemplateType.MAD_SAD_GLAD]: {
    type: TemplateType.MAD_SAD_GLAD,
    name: 'Mad / Sad / Glad',
    columns: [
      { columnId: 'mad', name: 'Mad', icon: '😠', description: 'What made you angry?', color: '#ef4444', sortOrder: 1 },
      { columnId: 'sad', name: 'Sad', icon: '😢', description: 'What made you sad?', color: '#3b82f6', sortOrder: 2 },
      { columnId: 'glad', name: 'Glad', icon: '😊', description: 'What made you happy?', color: '#22c55e', sortOrder: 3 },
    ],
  },
  [TemplateType.CUSTOM]: {
    type: TemplateType.CUSTOM,
    name: 'Custom',
    columns: [],
  },
};

// In-memory store for mock data
const mockStore = {
  retrospectives: new Map<string, Retrospective>(),
  items: new Map<string, RetrospectiveItem>(),
  actionItems: new Map<string, ActionItem>(),
  votes: new Map<string, Set<string>>(), // itemId -> Set<userId>
  userVotes: new Map<string, Set<string>>(), // `${retroId}-${userId}` -> Set<itemId>
  participants: new Map<string, Participant[]>(), // retroId -> participants
};

// Current mock user
const mockUser = {
  userId: 'user-1',
  displayName: 'Current User',
  avatarUrl: undefined,
};

// ============= API IMPLEMENTATION =============

const API_BASE = '/api/retrospective/v1';

// Helper for making API requests
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || 'API request failed');
  }

  return response.json();
}

// Retrospective Service
export const retrospectiveService = {
  async create(data: {
    teamId: string;
    sprintName: string;
    description?: string;
    templateType?: TemplateType;
    votingConfig?: Partial<VotingConfig>;
  }): Promise<{ retrospectiveId: string; retrospective: Retrospective }> {
    if (USE_MOCK) {
      const id = generateId();
      const template = defaultTemplates[data.templateType || TemplateType.WENT_WELL_TO_IMPROVE];
      const retrospective: Retrospective = {
        retrospectiveId: id,
        teamId: data.teamId,
        teamName: data.teamId, // Would come from team service
        sprintName: data.sprintName,
        description: data.description,
        status: RetrospectiveStatus.ACTIVE,
        template,
        votingConfig: {
          maxVotesPerUser: data.votingConfig?.maxVotesPerUser || 5,
          allowMultipleVotesPerItem: data.votingConfig?.allowMultipleVotesPerItem || false,
          anonymousVoting: data.votingConfig?.anonymousVoting || false,
        },
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        itemCount: 0,
        actionItemCount: 0,
        participantCount: 1,
      };
      mockStore.retrospectives.set(id, retrospective);
      mockStore.participants.set(id, [{
        userId: mockUser.userId,
        displayName: mockUser.displayName,
        avatarUrl: mockUser.avatarUrl,
        role: ParticipantRole.FACILITATOR,
        isOnline: true,
        joinedAt: new Date().toISOString(),
      }]);
      return { retrospectiveId: id, retrospective };
    }
    return apiRequest('/retrospectives', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async get(
    retrospectiveId: string,
    options?: { includeItems?: boolean; includeActionItems?: boolean }
  ): Promise<{
    retrospective: Retrospective;
    items?: RetrospectiveItem[];
    actionItems?: ActionItem[];
  }> {
    if (USE_MOCK) {
      const retrospective = mockStore.retrospectives.get(retrospectiveId);
      if (!retrospective) {
        throw new Error('Retrospective not found');
      }
      const items = options?.includeItems
        ? Array.from(mockStore.items.values()).filter(i => i.retrospectiveId === retrospectiveId)
        : undefined;
      const actionItems = options?.includeActionItems
        ? Array.from(mockStore.actionItems.values()).filter(a => a.retrospectiveId === retrospectiveId)
        : undefined;
      return { retrospective, items, actionItems };
    }
    const params = new URLSearchParams();
    if (options?.includeItems) params.set('includeItems', 'true');
    if (options?.includeActionItems) params.set('includeActionItems', 'true');
    return apiRequest(`/retrospectives/${retrospectiveId}?${params}`);
  },

  async list(filters?: {
    teamId?: string;
    statuses?: RetrospectiveStatus[];
  }): Promise<{ retrospectives: Retrospective[] }> {
    if (USE_MOCK) {
      let retrospectives = Array.from(mockStore.retrospectives.values());
      if (filters?.teamId) {
        retrospectives = retrospectives.filter(r => r.teamId === filters.teamId);
      }
      if (filters?.statuses && filters.statuses.length > 0) {
        retrospectives = retrospectives.filter(r => filters.statuses!.includes(r.status));
      }
      // Sort by created date, newest first
      retrospectives.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
      return { retrospectives };
    }
    const params = new URLSearchParams();
    if (filters?.teamId) params.set('teamId', filters.teamId);
    if (filters?.statuses) params.set('statuses', filters.statuses.join(','));
    return apiRequest(`/retrospectives?${params}`);
  },

  async update(
    retrospectiveId: string,
    data: Partial<Retrospective>
  ): Promise<void> {
    if (USE_MOCK) {
      const retro = mockStore.retrospectives.get(retrospectiveId);
      if (retro) {
        Object.assign(retro, data, { updated: new Date().toISOString() });
      }
      return;
    }
    return apiRequest(`/retrospectives/${retrospectiveId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async delete(retrospectiveId: string): Promise<void> {
    if (USE_MOCK) {
      mockStore.retrospectives.delete(retrospectiveId);
      return;
    }
    return apiRequest(`/retrospectives/${retrospectiveId}`, {
      method: 'DELETE',
    });
  },

  async startVoting(retrospectiveId: string): Promise<void> {
    if (USE_MOCK) {
      const retro = mockStore.retrospectives.get(retrospectiveId);
      if (retro) {
        retro.status = RetrospectiveStatus.VOTING;
        retro.updated = new Date().toISOString();
      }
      return;
    }
    return apiRequest(`/retrospectives/${retrospectiveId}/start-voting`, {
      method: 'POST',
    });
  },

  async startDiscussion(retrospectiveId: string): Promise<void> {
    if (USE_MOCK) {
      const retro = mockStore.retrospectives.get(retrospectiveId);
      if (retro) {
        retro.status = RetrospectiveStatus.DISCUSSING;
        retro.updated = new Date().toISOString();
      }
      return;
    }
    return apiRequest(`/retrospectives/${retrospectiveId}/start-discussion`, {
      method: 'POST',
    });
  },

  async complete(retrospectiveId: string): Promise<void> {
    if (USE_MOCK) {
      const retro = mockStore.retrospectives.get(retrospectiveId);
      if (retro) {
        retro.status = RetrospectiveStatus.COMPLETED;
        retro.updated = new Date().toISOString();
      }
      return;
    }
    return apiRequest(`/retrospectives/${retrospectiveId}/complete`, {
      method: 'POST',
    });
  },

  async export(
    retrospectiveId: string,
    format: 'pdf' | 'csv' | 'markdown' | 'json'
  ): Promise<Blob> {
    if (USE_MOCK) {
      const retro = mockStore.retrospectives.get(retrospectiveId);
      const items = Array.from(mockStore.items.values()).filter(i => i.retrospectiveId === retrospectiveId);
      const actionItems = Array.from(mockStore.actionItems.values()).filter(a => a.retrospectiveId === retrospectiveId);
      
      let content = '';
      if (format === 'json') {
        content = JSON.stringify({ retrospective: retro, items, actionItems }, null, 2);
      } else if (format === 'markdown') {
        content = `# ${retro?.sprintName}\n\n${retro?.description || ''}\n\n`;
        retro?.template?.columns.forEach(col => {
          content += `## ${col.icon} ${col.name}\n\n`;
          items.filter(i => i.columnId === col.columnId).forEach(item => {
            content += `- ${item.content} (${item.voteCount} votes)\n`;
          });
          content += '\n';
        });
        content += `## Action Items\n\n`;
        actionItems.forEach(ai => {
          content += `- [ ] ${ai.description}\n`;
        });
      } else {
        content = `Sprint: ${retro?.sprintName}\n`;
      }
      return new Blob([content], { type: 'text/plain' });
    }
    const response = await fetch(
      `${API_BASE}/retrospectives/${retrospectiveId}/export?format=${format}`
    );
    return response.blob();
  },
};

// Item Service
export const itemService = {
  async create(data: {
    retrospectiveId: string;
    columnId: string;
    content: string;
    isAnonymous?: boolean;
  }): Promise<{ item: RetrospectiveItem }> {
    if (USE_MOCK) {
      const id = generateId();
      const item: RetrospectiveItem = {
        itemId: id,
        retrospectiveId: data.retrospectiveId,
        columnId: data.columnId,
        content: data.content,
        createdByUserId: mockUser.userId,
        createdByName: data.isAnonymous ? 'Anonymous' : mockUser.displayName,
        isAnonymous: data.isAnonymous || false,
        voteCount: 0,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      };
      mockStore.items.set(id, item);
      // Update retrospective item count
      const retro = mockStore.retrospectives.get(data.retrospectiveId);
      if (retro) {
        retro.itemCount = (retro.itemCount || 0) + 1;
      }
      return { item };
    }
    return apiRequest('/items', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(itemId: string, data: { content: string }): Promise<void> {
    if (USE_MOCK) {
      const item = mockStore.items.get(itemId);
      if (item) {
        item.content = data.content;
        item.updated = new Date().toISOString();
      }
      return;
    }
    return apiRequest(`/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async delete(itemId: string, retrospectiveId: string): Promise<void> {
    if (USE_MOCK) {
      mockStore.items.delete(itemId);
      const retro = mockStore.retrospectives.get(retrospectiveId);
      if (retro) {
        retro.itemCount = Math.max(0, (retro.itemCount || 0) - 1);
      }
      return;
    }
    return apiRequest(`/items/${itemId}?retrospectiveId=${retrospectiveId}`, {
      method: 'DELETE',
    });
  },

  async list(
    retrospectiveId: string,
    options?: { columnId?: string; sortByVotes?: boolean }
  ): Promise<{ items: RetrospectiveItem[] }> {
    if (USE_MOCK) {
      let items = Array.from(mockStore.items.values()).filter(
        i => i.retrospectiveId === retrospectiveId
      );
      if (options?.columnId) {
        items = items.filter(i => i.columnId === options.columnId);
      }
      if (options?.sortByVotes) {
        items.sort((a, b) => b.voteCount - a.voteCount);
      }
      return { items };
    }
    const params = new URLSearchParams({ retrospectiveId });
    if (options?.columnId) params.set('columnId', options.columnId);
    if (options?.sortByVotes) params.set('sortByVotes', 'true');
    return apiRequest(`/items?${params}`);
  },

  async moveToColumn(
    itemId: string,
    retrospectiveId: string,
    targetColumnId: string,
    position?: number
  ): Promise<void> {
    if (USE_MOCK) {
      const item = mockStore.items.get(itemId);
      if (item) {
        item.columnId = targetColumnId;
        item.updated = new Date().toISOString();
      }
      return;
    }
    return apiRequest(`/items/${itemId}/move`, {
      method: 'POST',
      body: JSON.stringify({ retrospectiveId, targetColumnId, position }),
    });
  },
};

// Voting Service
export const votingService = {
  async castVote(retrospectiveId: string, itemId: string): Promise<void> {
    if (USE_MOCK) {
      const item = mockStore.items.get(itemId);
      if (item) {
        item.voteCount = (item.voteCount || 0) + 1;
      }
      // Track user votes
      const key = `${retrospectiveId}-${mockUser.userId}`;
      if (!mockStore.userVotes.has(key)) {
        mockStore.userVotes.set(key, new Set());
      }
      mockStore.userVotes.get(key)!.add(itemId);
      return;
    }
    return apiRequest('/votes', {
      method: 'POST',
      body: JSON.stringify({ retrospectiveId, itemId }),
    });
  },

  async removeVote(retrospectiveId: string, itemId: string): Promise<void> {
    if (USE_MOCK) {
      const item = mockStore.items.get(itemId);
      if (item && item.voteCount > 0) {
        item.voteCount--;
      }
      const key = `${retrospectiveId}-${mockUser.userId}`;
      mockStore.userVotes.get(key)?.delete(itemId);
      return;
    }
    return apiRequest('/votes', {
      method: 'DELETE',
      body: JSON.stringify({ retrospectiveId, itemId }),
    });
  },

  async getVoteSummary(
    retrospectiveId: string
  ): Promise<{ summaries: VoteSummary[]; totalVotes: number }> {
    if (USE_MOCK) {
      const items = Array.from(mockStore.items.values()).filter(
        i => i.retrospectiveId === retrospectiveId
      );
      const summaries: VoteSummary[] = items.map(item => ({
        itemId: item.itemId,
        voteCount: item.voteCount,
        rank: 0, // Will be calculated
      }));
      summaries.sort((a, b) => b.voteCount - a.voteCount);
      summaries.forEach((s, i) => { s.rank = i + 1; });
      const totalVotes = summaries.reduce((sum, s) => sum + s.voteCount, 0);
      return { summaries, totalVotes };
    }
    return apiRequest(`/votes/summary?retrospectiveId=${retrospectiveId}`);
  },

  async getUserVotes(
    retrospectiveId: string
  ): Promise<{ summary: UserVoteSummary }> {
    if (USE_MOCK) {
      const retro = mockStore.retrospectives.get(retrospectiveId);
      const maxVotes = retro?.votingConfig?.maxVotesPerUser || 5;
      const key = `${retrospectiveId}-${mockUser.userId}`;
      const votedItemIds = Array.from(mockStore.userVotes.get(key) || []);
      return {
        summary: {
          userId: mockUser.userId,
          maxVotes,
          votesCast: votedItemIds.length,
          votesRemaining: maxVotes - votedItemIds.length,
          votedItemIds,
        },
      };
    }
    return apiRequest(`/votes/user?retrospectiveId=${retrospectiveId}`);
  },
};

// Action Item Service
export const actionItemService = {
  async create(data: {
    retrospectiveId?: string;
    sourceItemId?: string;
    teamId: string;
    description: string;
    assigneeId?: string;
    priority?: ActionItemPriority;
    dueDate?: string;
  }): Promise<{ actionItem: ActionItem }> {
    if (USE_MOCK) {
      const id = generateId();
      const actionItem: ActionItem = {
        actionItemId: id,
        retrospectiveId: data.retrospectiveId,
        teamId: data.teamId,
        description: data.description,
        assigneeId: data.assigneeId,
        assigneeName: data.assigneeId ? 'Team Member' : undefined,
        status: ActionItemStatus.NOT_STARTED,
        priority: data.priority || ActionItemPriority.MEDIUM,
        dueDate: data.dueDate,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      };
      mockStore.actionItems.set(id, actionItem);
      if (data.retrospectiveId) {
        const retro = mockStore.retrospectives.get(data.retrospectiveId);
        if (retro) {
          retro.actionItemCount = (retro.actionItemCount || 0) + 1;
        }
      }
      return { actionItem };
    }
    return apiRequest('/action-items', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(actionItemId: string, data: Partial<ActionItem>): Promise<void> {
    if (USE_MOCK) {
      const actionItem = mockStore.actionItems.get(actionItemId);
      if (actionItem) {
        Object.assign(actionItem, data, { updated: new Date().toISOString() });
      }
      return;
    }
    return apiRequest(`/action-items/${actionItemId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async updateStatus(
    actionItemId: string,
    status: ActionItemStatus,
    notes?: string
  ): Promise<void> {
    if (USE_MOCK) {
      const actionItem = mockStore.actionItems.get(actionItemId);
      if (actionItem) {
        actionItem.status = status;
        actionItem.updated = new Date().toISOString();
      }
      return;
    }
    return apiRequest(`/action-items/${actionItemId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, notes }),
    });
  },

  async delete(actionItemId: string): Promise<void> {
    if (USE_MOCK) {
      mockStore.actionItems.delete(actionItemId);
      return;
    }
    return apiRequest(`/action-items/${actionItemId}`, {
      method: 'DELETE',
    });
  },

  async list(filters: {
    retrospectiveId?: string;
    teamId?: string;
    assigneeId?: string;
    statuses?: ActionItemStatus[];
  }): Promise<{ actionItems: ActionItem[] }> {
    if (USE_MOCK) {
      let actionItems = Array.from(mockStore.actionItems.values());
      if (filters.retrospectiveId) {
        actionItems = actionItems.filter(a => a.retrospectiveId === filters.retrospectiveId);
      }
      if (filters.teamId) {
        actionItems = actionItems.filter(a => a.teamId === filters.teamId);
      }
      if (filters.assigneeId) {
        actionItems = actionItems.filter(a => a.assigneeId === filters.assigneeId);
      }
      if (filters.statuses && filters.statuses.length > 0) {
        actionItems = actionItems.filter(a => filters.statuses!.includes(a.status));
      }
      return { actionItems };
    }
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        params.set(key, Array.isArray(value) ? value.join(',') : String(value));
      }
    });
    return apiRequest(`/action-items?${params}`);
  },

  async listByTeam(
    teamId: string,
    includeCompleted?: boolean
  ): Promise<{ actionItems: ActionItem[] }> {
    if (USE_MOCK) {
      let actionItems = Array.from(mockStore.actionItems.values()).filter(
        a => a.teamId === teamId
      );
      if (!includeCompleted) {
        actionItems = actionItems.filter(a => a.status !== ActionItemStatus.DONE);
      }
      return { actionItems };
    }
    const params = new URLSearchParams({ teamId });
    if (includeCompleted) params.set('includeCompleted', 'true');
    return apiRequest(`/action-items/by-team?${params}`);
  },
};

// Realtime Service
export const realtimeService = {
  async join(
    retrospectiveId: string,
    displayName: string,
    avatarUrl?: string
  ): Promise<{ presence: PresenceInfo }> {
    if (USE_MOCK) {
      const participants = mockStore.participants.get(retrospectiveId) || [];
      const existing = participants.find(p => p.userId === mockUser.userId);
      if (!existing) {
        participants.push({
          userId: mockUser.userId,
          displayName,
          avatarUrl,
          role: ParticipantRole.PARTICIPANT,
          isOnline: true,
          joinedAt: new Date().toISOString(),
        });
        mockStore.participants.set(retrospectiveId, participants);
      } else {
        existing.isOnline = true;
      }
      return {
        presence: {
          retrospectiveId,
          participants,
          onlineCount: participants.filter(p => p.isOnline).length,
        },
      };
    }
    return apiRequest('/realtime/join', {
      method: 'POST',
      body: JSON.stringify({ retrospectiveId, displayName, avatarUrl }),
    });
  },

  async leave(retrospectiveId: string): Promise<void> {
    if (USE_MOCK) {
      const participants = mockStore.participants.get(retrospectiveId) || [];
      const participant = participants.find(p => p.userId === mockUser.userId);
      if (participant) {
        participant.isOnline = false;
      }
      return;
    }
    return apiRequest('/realtime/leave', {
      method: 'POST',
      body: JSON.stringify({ retrospectiveId }),
    });
  },

  async getParticipants(
    retrospectiveId: string
  ): Promise<{ presence: PresenceInfo }> {
    if (USE_MOCK) {
      const participants = mockStore.participants.get(retrospectiveId) || [];
      return {
        presence: {
          retrospectiveId,
          participants,
          onlineCount: participants.filter(p => p.isOnline).length,
        },
      };
    }
    return apiRequest(`/realtime/participants?retrospectiveId=${retrospectiveId}`);
  },

  async heartbeat(retrospectiveId: string): Promise<void> {
    if (USE_MOCK) {
      return; // No-op for mock
    }
    return apiRequest('/realtime/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ retrospectiveId }),
    });
  },
};

// Template Service
export const templateService = {
  async getDefaultTemplate(
    type: TemplateType
  ): Promise<{ template: Template }> {
    if (USE_MOCK) {
      const template = defaultTemplates[type] || defaultTemplates[TemplateType.WENT_WELL_TO_IMPROVE];
      return { template };
    }
    return apiRequest(`/templates/default?type=${type}`);
  },
};
