package vstore

import (
	"time"
)

// RetrospectiveStatus represents the current phase of a retrospective
type RetrospectiveStatus int32

const (
	RetrospectiveStatusUnspecified RetrospectiveStatus = 0
	RetrospectiveStatusDraft       RetrospectiveStatus = 1
	RetrospectiveStatusActive      RetrospectiveStatus = 2
	RetrospectiveStatusVoting      RetrospectiveStatus = 3
	RetrospectiveStatusDiscussing  RetrospectiveStatus = 4
	RetrospectiveStatusCompleted   RetrospectiveStatus = 5
)

// ActionItemStatus represents the state of an action item
type ActionItemStatus int32

const (
	ActionItemStatusUnspecified ActionItemStatus = 0
	ActionItemStatusNotStarted  ActionItemStatus = 1
	ActionItemStatusInProgress  ActionItemStatus = 2
	ActionItemStatusDone        ActionItemStatus = 3
	ActionItemStatusWontDo      ActionItemStatus = 4
)

// ActionItemPriority indicates urgency
type ActionItemPriority int32

const (
	ActionItemPriorityUnspecified ActionItemPriority = 0
	ActionItemPriorityLow         ActionItemPriority = 1
	ActionItemPriorityMedium      ActionItemPriority = 2
	ActionItemPriorityHigh        ActionItemPriority = 3
	ActionItemPriorityCritical    ActionItemPriority = 4
)

// TemplateType defines the pre-built retrospective formats
type TemplateType int32

const (
	TemplateTypeUnspecified      TemplateType = 0
	TemplateTypeWentWellToImprove TemplateType = 1
	TemplateTypeStartStopContinue TemplateType = 2
	TemplateTypeFourLs           TemplateType = 3
	TemplateTypeMadSadGlad       TemplateType = 4
	TemplateTypeCustom           TemplateType = 5
)

// ParticipantRole defines the role of a participant
type ParticipantRole int32

const (
	ParticipantRoleUnspecified ParticipantRole = 0
	ParticipantRoleMember      ParticipantRole = 1
	ParticipantRoleFacilitator ParticipantRole = 2
	ParticipantRoleObserver    ParticipantRole = 3
)

// Retrospective represents a sprint retrospective session
type Retrospective struct {
	RetrospectiveID string              `vstore:"retrospective_id"`
	TeamID          string              `vstore:"team_id"`
	TeamName        string              `vstore:"team_name"`
	SprintName      string              `vstore:"sprint_name"`
	Description     string              `vstore:"description"`
	TemplateType    TemplateType        `vstore:"template_type"`
	TemplateColumns []*TemplateColumn   `vstore:"template_columns"`
	Status          RetrospectiveStatus `vstore:"status"`
	VotingConfig    *VotingConfig       `vstore:"voting_config"`
	CreatedBy       string              `vstore:"created_by"`
	FacilitatorID   string              `vstore:"facilitator_id"`
	ItemCount       int32               `vstore:"item_count"`
	ActionItemCount int32               `vstore:"action_item_count"`
	ParticipantCount int32              `vstore:"participant_count"`
	StartedAt       time.Time           `vstore:"started_at"`
	CompletedAt     time.Time           `vstore:"completed_at"`
	Created         time.Time           `vstore:"created"`
	Updated         time.Time           `vstore:"updated"`
	Deleted         time.Time           `vstore:"deleted"`
}

// TemplateColumn represents a column in the retrospective board
type TemplateColumn struct {
	ColumnID    string `vstore:"column_id"`
	Name        string `vstore:"name"`
	Description string `vstore:"description"`
	Icon        string `vstore:"icon"`
	SortOrder   int32  `vstore:"sort_order"`
	Color       string `vstore:"color"`
}

// VotingConfig defines the voting rules for a retrospective
type VotingConfig struct {
	MaxVotesPerUser           int32 `vstore:"max_votes_per_user"`
	AllowMultipleVotesPerItem bool  `vstore:"allow_multiple_votes_per_item"`
	AnonymousVoting           bool  `vstore:"anonymous_voting"`
}

// RetrospectiveItem represents a card on the retrospective board
type RetrospectiveItem struct {
	ItemID          string    `vstore:"item_id"`
	RetrospectiveID string    `vstore:"retrospective_id"`
	ColumnID        string    `vstore:"column_id"`
	Content         string    `vstore:"content"`
	CreatedBy       string    `vstore:"created_by"`
	CreatedByName   string    `vstore:"created_by_name"`
	VoteCount       int32     `vstore:"vote_count"`
	IsAnonymous     bool      `vstore:"is_anonymous"`
	Position        int32     `vstore:"position"`
	HasActionItem   bool      `vstore:"has_action_item"`
	Created         time.Time `vstore:"created"`
	Updated         time.Time `vstore:"updated"`
	Deleted         time.Time `vstore:"deleted"`
}

// Vote represents a single vote cast by a user
type Vote struct {
	VoteID          string    `vstore:"vote_id"`
	RetrospectiveID string    `vstore:"retrospective_id"`
	ItemID          string    `vstore:"item_id"`
	UserID          string    `vstore:"user_id"`
	Created         time.Time `vstore:"created"`
}

// ActionItem represents a task created from a retrospective
type ActionItem struct {
	ActionItemID     string             `vstore:"action_item_id"`
	RetrospectiveID  string             `vstore:"retrospective_id"`
	SourceItemID     string             `vstore:"source_item_id"`
	TeamID           string             `vstore:"team_id"`
	Description      string             `vstore:"description"`
	AssigneeID       string             `vstore:"assignee_id"`
	AssigneeName     string             `vstore:"assignee_name"`
	Status           ActionItemStatus   `vstore:"status"`
	Priority         ActionItemPriority `vstore:"priority"`
	DueDate          time.Time          `vstore:"due_date"`
	CreatedBy        string             `vstore:"created_by"`
	SourceSprintName string             `vstore:"source_sprint_name"`
	Notes            string             `vstore:"notes"`
	Created          time.Time          `vstore:"created"`
	Updated          time.Time          `vstore:"updated"`
	Deleted          time.Time          `vstore:"deleted"`
}

// Participant represents a user in a retrospective session
type Participant struct {
	ParticipantID   string          `vstore:"participant_id"`
	RetrospectiveID string          `vstore:"retrospective_id"`
	UserID          string          `vstore:"user_id"`
	DisplayName     string          `vstore:"display_name"`
	AvatarURL       string          `vstore:"avatar_url"`
	Role            ParticipantRole `vstore:"role"`
	IsOnline        bool            `vstore:"is_online"`
	JoinedAt        time.Time       `vstore:"joined_at"`
	LastActive      time.Time       `vstore:"last_active"`
}
