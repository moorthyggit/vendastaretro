import { create } from 'zustand';
import type {
  Retrospective,
  RetrospectiveItem,
  ActionItem,
  Participant,
  UserVoteSummary,
  RetrospectiveEvent,
  RetrospectiveStatus,
} from '../types';

interface RetrospectiveState {
  // Current retrospective data
  retrospective: Retrospective | null;
  items: RetrospectiveItem[];
  actionItems: ActionItem[];
  participants: Participant[];
  userVotes: UserVoteSummary | null;

  // UI state
  isLoading: boolean;
  error: string | null;
  selectedItemId: string | null;

  // Actions
  setRetrospective: (retro: Retrospective | null) => void;
  setItems: (items: RetrospectiveItem[]) => void;
  addItem: (item: RetrospectiveItem) => void;
  updateItem: (item: RetrospectiveItem) => void;
  removeItem: (itemId: string) => void;
  setActionItems: (actionItems: ActionItem[]) => void;
  addActionItem: (actionItem: ActionItem) => void;
  updateActionItem: (actionItem: ActionItem) => void;
  removeActionItem: (actionItemId: string) => void;
  setParticipants: (participants: Participant[]) => void;
  addParticipant: (participant: Participant) => void;
  removeParticipant: (userId: string) => void;
  setUserVotes: (votes: UserVoteSummary | null) => void;
  updateItemVoteCount: (itemId: string, voteCount: number) => void;
  setStatus: (status: RetrospectiveStatus) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedItemId: (itemId: string | null) => void;

  // Handle real-time events
  handleEvent: (event: RetrospectiveEvent) => void;

  // Reset state
  reset: () => void;
}

const initialState = {
  retrospective: null,
  items: [],
  actionItems: [],
  participants: [],
  userVotes: null,
  isLoading: false,
  error: null,
  selectedItemId: null,
};

export const useRetrospectiveStore = create<RetrospectiveState>((set, get) => ({
  ...initialState,

  setRetrospective: (retrospective) => set({ retrospective }),

  setItems: (items) => set({ items }),

  addItem: (item) =>
    set((state) => ({
      items: [...state.items, item],
    })),

  updateItem: (updatedItem) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.itemId === updatedItem.itemId ? updatedItem : item
      ),
    })),

  removeItem: (itemId) =>
    set((state) => ({
      items: state.items.filter((item) => item.itemId !== itemId),
    })),

  setActionItems: (actionItems) => set({ actionItems }),

  addActionItem: (actionItem) =>
    set((state) => ({
      actionItems: [...state.actionItems, actionItem],
    })),

  updateActionItem: (updatedItem) =>
    set((state) => ({
      actionItems: state.actionItems.map((item) =>
        item.actionItemId === updatedItem.actionItemId ? updatedItem : item
      ),
    })),

  removeActionItem: (actionItemId) =>
    set((state) => ({
      actionItems: state.actionItems.filter(
        (item) => item.actionItemId !== actionItemId
      ),
    })),

  setParticipants: (participants) => set({ participants }),

  addParticipant: (participant) =>
    set((state) => ({
      participants: [...state.participants, participant],
    })),

  removeParticipant: (userId) =>
    set((state) => ({
      participants: state.participants.filter((p) => p.userId !== userId),
    })),

  setUserVotes: (userVotes) => set({ userVotes }),

  updateItemVoteCount: (itemId, voteCount) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.itemId === itemId ? { ...item, voteCount } : item
      ),
    })),

  setStatus: (status) =>
    set((state) => ({
      retrospective: state.retrospective
        ? { ...state.retrospective, status }
        : null,
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  setSelectedItemId: (selectedItemId) => set({ selectedItemId }),

  handleEvent: (event) => {
    const state = get();

    switch (event.type) {
      case 'itemCreated':
        state.addItem(event.item);
        break;

      case 'itemUpdated':
        state.updateItem(event.item);
        break;

      case 'itemDeleted':
        state.removeItem(event.itemId);
        break;

      case 'voteCast':
      case 'voteRemoved':
        state.updateItemVoteCount(event.itemId, event.newVoteCount);
        break;

      case 'participantJoined':
        state.addParticipant(event.participant);
        if (state.retrospective) {
          set({
            retrospective: {
              ...state.retrospective,
              participantCount: event.participantCount,
            },
          });
        }
        break;

      case 'participantLeft':
        state.removeParticipant(event.userId);
        if (state.retrospective) {
          set({
            retrospective: {
              ...state.retrospective,
              participantCount: event.participantCount,
            },
          });
        }
        break;

      case 'statusChanged':
        state.setStatus(event.newStatus);
        break;

      case 'actionItemCreated':
        state.addActionItem(event.actionItem);
        break;

      case 'actionItemUpdated':
        state.updateActionItem(event.actionItem);
        break;
    }
  },

  reset: () => set(initialState),
}));

// Selector hooks for common patterns
export const useItems = () => useRetrospectiveStore((state) => state.items);
export const useItemsByColumn = (columnId: string) =>
  useRetrospectiveStore((state) =>
    state.items.filter((item) => item.columnId === columnId)
  );
export const useParticipantCount = () =>
  useRetrospectiveStore((state) => state.participants.length);
export const useIsVotingPhase = () =>
  useRetrospectiveStore(
    (state) => state.retrospective?.status === RetrospectiveStatus.VOTING
  );
