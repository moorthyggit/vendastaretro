package vstore

// Schema definitions for vstore entities
// In production, these would be registered with vstore using the codegen tool

// RetrospectiveSchema returns the vstore schema for Retrospective
// Key: team_id + retrospective_id (allows listing by team)
func RetrospectiveSchema() map[string]interface{} {
	return map[string]interface{}{
		"name":        "Retrospective",
		"key_parts":   []string{"team_id", "retrospective_id"},
		"backup":      "daily",
		"description": "Sprint retrospective sessions",
		"indexes": []map[string]interface{}{
			{
				"name":   "by_status",
				"fields": []string{"status"},
			},
			{
				"name":   "by_created",
				"fields": []string{"created"},
			},
			{
				"name":   "by_facilitator",
				"fields": []string{"facilitator_id"},
			},
		},
	}
}

// RetrospectiveItemSchema returns the vstore schema for RetrospectiveItem
// Key: retrospective_id + item_id (allows listing items by retro)
func RetrospectiveItemSchema() map[string]interface{} {
	return map[string]interface{}{
		"name":        "RetrospectiveItem",
		"key_parts":   []string{"retrospective_id", "item_id"},
		"backup":      "daily",
		"description": "Items/cards on a retrospective board",
		"indexes": []map[string]interface{}{
			{
				"name":   "by_column",
				"fields": []string{"column_id"},
			},
			{
				"name":   "by_vote_count",
				"fields": []string{"vote_count"},
			},
			{
				"name":   "by_created_by",
				"fields": []string{"created_by"},
			},
		},
	}
}

// VoteSchema returns the vstore schema for Vote
// Key: retrospective_id + item_id + user_id (ensures one vote per user per item)
func VoteSchema() map[string]interface{} {
	return map[string]interface{}{
		"name":        "Vote",
		"key_parts":   []string{"retrospective_id", "item_id", "user_id"},
		"backup":      "daily",
		"description": "Votes cast on retrospective items",
		"indexes": []map[string]interface{}{
			{
				"name":   "by_user",
				"fields": []string{"user_id"},
			},
			{
				"name":   "by_item",
				"fields": []string{"item_id"},
			},
		},
	}
}

// ActionItemSchema returns the vstore schema for ActionItem
// Key: team_id + action_item_id (allows listing by team across retros)
func ActionItemSchema() map[string]interface{} {
	return map[string]interface{}{
		"name":        "ActionItem",
		"key_parts":   []string{"team_id", "action_item_id"},
		"backup":      "daily",
		"description": "Action items created from retrospectives",
		"indexes": []map[string]interface{}{
			{
				"name":   "by_retrospective",
				"fields": []string{"retrospective_id"},
			},
			{
				"name":   "by_status",
				"fields": []string{"status"},
			},
			{
				"name":   "by_assignee",
				"fields": []string{"assignee_id"},
			},
			{
				"name":   "by_due_date",
				"fields": []string{"due_date"},
			},
			{
				"name":   "by_priority",
				"fields": []string{"priority"},
			},
		},
	}
}

// ParticipantSchema returns the vstore schema for Participant
// Key: retrospective_id + user_id (tracks presence per user per retro)
func ParticipantSchema() map[string]interface{} {
	return map[string]interface{}{
		"name":        "Participant",
		"key_parts":   []string{"retrospective_id", "user_id"},
		"backup":      "none", // Ephemeral data, no backup needed
		"description": "Active participants in a retrospective session",
		"ttl":         "24h", // Auto-expire after 24 hours
		"indexes": []map[string]interface{}{
			{
				"name":   "by_online",
				"fields": []string{"is_online"},
			},
		},
	}
}

// AllSchemas returns all vstore schemas for the retrospective service
func AllSchemas() []map[string]interface{} {
	return []map[string]interface{}{
		RetrospectiveSchema(),
		RetrospectiveItemSchema(),
		VoteSchema(),
		ActionItemSchema(),
		ParticipantSchema(),
	}
}
