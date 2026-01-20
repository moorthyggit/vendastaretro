// Types matching the proto definitions

export enum RetrospectiveStatus {
  UNSPECIFIED = 0,
  DRAFT = 1,
  ACTIVE = 2,
  VOTING = 3,
  DISCUSSING = 4,
  COMPLETED = 5,
}

export enum TemplateType {
  UNSPECIFIED = 0,
  WENT_WELL_TO_IMPROVE = 1,
  START_STOP_CONTINUE = 2,
  FOUR_LS = 3,
  MAD_SAD_GLAD = 4,
  CUSTOM = 5,
}

export enum ActionItemStatus {
  UNSPECIFIED = 0,
  NOT_STARTED = 1,
  IN_PROGRESS = 2,
  DONE = 3,
  WONT_DO = 4,
}

export enum ActionItemPriority {
  UNSPECIFIED = 0,
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4,
}

export enum ParticipantRole {
  UNSPECIFIED = 0,
  MEMBER = 1,
  FACILITATOR = 2,
  OBSERVER = 3,
}

export interface TemplateColumn {
  columnId: string;
  name: string;
  description: string;
  icon: string;
  sortOrder: number;
  color: string;
}

export interface VotingConfig {
  maxVotesPerUser: number;
  allowMultipleVotesPerItem: boolean;
  anonymousVoting: boolean;
}

export interface Retrospective {
  retrospectiveId: string;
  teamId: string;
  teamName: string;
  sprintName: string;
  description: string;
  template: {
    type: TemplateType;
    columns: TemplateColumn[];
  };
  status: RetrospectiveStatus;
  votingConfig: VotingConfig;
  created: string;
  updated: string;
  startedAt?: string;
  completedAt?: string;
  createdBy: string;
  facilitatorId: string;
  itemCount: number;
  actionItemCount: number;
  participantCount: number;
}

export interface RetrospectiveItem {
  itemId: string;
  retrospectiveId: string;
  columnId: string;
  content: string;
  createdBy: string;
  createdByName: string;
  voteCount: number;
  created: string;
  updated: string;
  isAnonymous: boolean;
  position: number;
  hasActionItem: boolean;
}

export interface ActionItem {
  actionItemId: string;
  retrospectiveId: string;
  sourceItemId: string;
  teamId: string;
  description: string;
  assigneeId: string;
  assigneeName: string;
  status: ActionItemStatus;
  priority: ActionItemPriority;
  dueDate?: string;
  created: string;
  updated: string;
  createdBy: string;
  sourceSprintName: string;
  notes: string;
}

export interface Participant {
  userId: string;
  displayName: string;
  avatarUrl: string;
  joinedAt: string;
  role: ParticipantRole;
  lastActive: string;
  isOnline: boolean;
}

export interface PresenceInfo {
  participantCount: number;
  participants: Participant[];
}

export interface VoteSummary {
  itemId: string;
  voteCount: number;
  rank: number;
  currentUserVoted: boolean;
}

export interface UserVoteSummary {
  userId: string;
  votesCast: number;
  votesRemaining: number;
  votedItemIds: string[];
}

// Event types for real-time updates
export type RetrospectiveEvent =
  | { type: 'itemCreated'; item: RetrospectiveItem }
  | { type: 'itemUpdated'; item: RetrospectiveItem }
  | { type: 'itemDeleted'; itemId: string; columnId: string }
  | { type: 'voteCast'; itemId: string; newVoteCount: number; userId: string }
  | { type: 'voteRemoved'; itemId: string; newVoteCount: number; userId: string }
  | { type: 'participantJoined'; participant: Participant; participantCount: number }
  | { type: 'participantLeft'; userId: string; participantCount: number }
  | { type: 'statusChanged'; previousStatus: RetrospectiveStatus; newStatus: RetrospectiveStatus; changedBy: string }
  | { type: 'actionItemCreated'; actionItem: ActionItem }
  | { type: 'actionItemUpdated'; actionItem: ActionItem };
