package api

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"time"

	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	pb "github.com/vendasta/generated-protos-go/retrospective/v1"
	"github.com/vendasta/retrospective/internal/vstore"
)

// RetrospectiveService implements the RetrospectiveService gRPC service
type RetrospectiveService struct {
	pb.UnimplementedRetrospectiveServiceServer
	retroStore      *InMemoryRetrospectiveStore
	itemStore       *InMemoryItemStore
	actionItemStore *InMemoryActionItemStore
}

// NewRetrospectiveService creates a new RetrospectiveService
func NewRetrospectiveService(
	retroStore *InMemoryRetrospectiveStore,
	itemStore *InMemoryItemStore,
	actionItemStore *InMemoryActionItemStore,
) *RetrospectiveService {
	return &RetrospectiveService{
		retroStore:      retroStore,
		itemStore:       itemStore,
		actionItemStore: actionItemStore,
	}
}

// Create creates a new retrospective
func (s *RetrospectiveService) Create(ctx context.Context, req *pb.CreateRetrospectiveRequest) (*pb.CreateRetrospectiveResponse, error) {
	if req.TeamId == "" {
		return nil, ToGRPCError(fmt.Errorf("%w: team_id is required", ErrInvalidArgument))
	}
	if req.SprintName == "" {
		return nil, ToGRPCError(fmt.Errorf("%w: sprint_name is required", ErrInvalidArgument))
	}

	// Generate ID
	retroID := fmt.Sprintf("RETRO-%d", time.Now().UnixNano())

	// Get template columns
	templateType := req.TemplateType
	if templateType == pb.RetrospectiveTemplateType_RETROSPECTIVE_TEMPLATE_TYPE_UNSPECIFIED {
		templateType = pb.RetrospectiveTemplateType_RETROSPECTIVE_TEMPLATE_TYPE_WENT_WELL_TO_IMPROVE
	}

	columns := getDefaultTemplateColumns(templateType)
	if req.CustomTemplate != nil && len(req.CustomTemplate.Columns) > 0 {
		columns = convertPbColumnsToVstore(req.CustomTemplate.Columns)
	}

	// Set default voting config
	votingConfig := &vstore.VotingConfig{
		MaxVotesPerUser:           5,
		AllowMultipleVotesPerItem: false,
		AnonymousVoting:           false,
	}
	if req.VotingConfig != nil {
		if req.VotingConfig.MaxVotesPerUser > 0 {
			votingConfig.MaxVotesPerUser = req.VotingConfig.MaxVotesPerUser
		}
		votingConfig.AllowMultipleVotesPerItem = req.VotingConfig.AllowMultipleVotesPerItem
		votingConfig.AnonymousVoting = req.VotingConfig.AnonymousVoting
	}

	// Create retrospective
	retro := &vstore.Retrospective{
		RetrospectiveID:  retroID,
		TeamID:           req.TeamId,
		SprintName:       req.SprintName,
		Description:      req.Description,
		TemplateType:     vstore.TemplateType(templateType),
		TemplateColumns:  columns,
		Status:           vstore.RetrospectiveStatusDraft,
		VotingConfig:     votingConfig,
		CreatedBy:        getUserIDFromContext(ctx),
		FacilitatorID:    req.FacilitatorId,
	}

	if retro.FacilitatorID == "" {
		retro.FacilitatorID = retro.CreatedBy
	}

	if err := s.retroStore.Create(retro); err != nil {
		return nil, ToGRPCError(err)
	}

	return &pb.CreateRetrospectiveResponse{
		RetrospectiveId: retroID,
		Retrospective:   convertVstoreRetroToPb(retro),
	}, nil
}

// Get retrieves a retrospective by ID
func (s *RetrospectiveService) Get(ctx context.Context, req *pb.GetRetrospectiveRequest) (*pb.GetRetrospectiveResponse, error) {
	if req.RetrospectiveId == "" {
		return nil, ToGRPCError(fmt.Errorf("%w: retrospective_id is required", ErrInvalidArgument))
	}

	retro, err := s.retroStore.Get(req.RetrospectiveId)
	if err != nil {
		return nil, ToGRPCError(err)
	}

	result := &pb.RetrospectiveWithDetails{
		Retrospective: convertVstoreRetroToPb(retro),
	}

	// Include items if requested
	if req.IncludeItems {
		items, err := s.itemStore.ListByRetrospective(req.RetrospectiveId, "", false)
		if err == nil {
			for _, item := range items {
				result.Items = append(result.Items, convertVstoreItemToPb(item))
			}
		}
	}

	// Include action items if requested
	if req.IncludeActionItems {
		actionItems, err := s.actionItemStore.ListByRetrospective(req.RetrospectiveId)
		if err == nil {
			for _, ai := range actionItems {
				result.ActionItems = append(result.ActionItems, convertVstoreActionItemToPb(ai))
			}
		}
	}

	return &pb.GetRetrospectiveResponse{
		Retrospective: result,
	}, nil
}

// GetMulti retrieves multiple retrospectives by ID
func (s *RetrospectiveService) GetMulti(ctx context.Context, req *pb.GetMultiRetrospectivesRequest) (*pb.GetMultiRetrospectivesResponse, error) {
	var containers []*pb.GetMultiRetrospectivesResponse_RetrospectiveContainer

	for _, id := range req.RetrospectiveIds {
		retro, err := s.retroStore.Get(id)
		if err != nil {
			containers = append(containers, &pb.GetMultiRetrospectivesResponse_RetrospectiveContainer{})
			continue
		}
		containers = append(containers, &pb.GetMultiRetrospectivesResponse_RetrospectiveContainer{
			Retrospective: convertVstoreRetroToPb(retro),
		})
	}

	return &pb.GetMultiRetrospectivesResponse{
		Retrospectives: containers,
	}, nil
}

// List lists retrospectives with filters
func (s *RetrospectiveService) List(ctx context.Context, req *pb.ListRetrospectivesRequest) (*pb.ListRetrospectivesResponse, error) {
	var teamID string
	var statuses []vstore.RetrospectiveStatus

	if req.Filters != nil {
		teamID = req.Filters.TeamId
		for _, status := range req.Filters.Statuses {
			statuses = append(statuses, vstore.RetrospectiveStatus(status))
		}
	}

	cursor := ""
	pageSize := int64(20)
	if req.PagingOptions != nil {
		cursor = req.PagingOptions.Cursor
		if req.PagingOptions.PageSize > 0 {
			pageSize = req.PagingOptions.PageSize
		}
	}

	retros, nextCursor, hasMore, err := s.retroStore.List(teamID, statuses, cursor, int(pageSize))
	if err != nil {
		return nil, ToGRPCError(err)
	}

	var pbRetros []*pb.Retrospective
	for _, retro := range retros {
		pbRetros = append(pbRetros, convertVstoreRetroToPb(retro))
	}

	return &pb.ListRetrospectivesResponse{
		Retrospectives: pbRetros,
		PagingMetadata: &pb.ListRetrospectivesResponse_PagingMetadata{
			NextCursor: nextCursor,
			HasMore:    hasMore,
		},
	}, nil
}

// Update updates a retrospective
func (s *RetrospectiveService) Update(ctx context.Context, req *pb.UpdateRetrospectiveRequest) (*emptypb.Empty, error) {
	if req.Retrospective == nil || req.Retrospective.RetrospectiveId == "" {
		return nil, ToGRPCError(fmt.Errorf("%w: retrospective is required", ErrInvalidArgument))
	}

	existing, err := s.retroStore.Get(req.Retrospective.RetrospectiveId)
	if err != nil {
		return nil, ToGRPCError(err)
	}

	// Apply updates based on field mask (simplified - update all provided fields)
	if req.Retrospective.SprintName != "" {
		existing.SprintName = req.Retrospective.SprintName
	}
	if req.Retrospective.Description != "" {
		existing.Description = req.Retrospective.Description
	}
	if req.Retrospective.FacilitatorId != "" {
		existing.FacilitatorID = req.Retrospective.FacilitatorId
	}

	if err := s.retroStore.Update(existing); err != nil {
		return nil, ToGRPCError(err)
	}

	return &emptypb.Empty{}, nil
}

// Delete deletes a retrospective
func (s *RetrospectiveService) Delete(ctx context.Context, req *pb.DeleteRetrospectiveRequest) (*emptypb.Empty, error) {
	if req.RetrospectiveId == "" {
		return nil, ToGRPCError(fmt.Errorf("%w: retrospective_id is required", ErrInvalidArgument))
	}

	if err := s.retroStore.Delete(req.RetrospectiveId); err != nil {
		return nil, ToGRPCError(err)
	}

	return &emptypb.Empty{}, nil
}

// StartVoting transitions a retrospective to voting phase
func (s *RetrospectiveService) StartVoting(ctx context.Context, req *pb.StartVotingRequest) (*emptypb.Empty, error) {
	retro, err := s.retroStore.Get(req.RetrospectiveId)
	if err != nil {
		return nil, ToGRPCError(err)
	}

	if retro.Status != vstore.RetrospectiveStatusActive && retro.Status != vstore.RetrospectiveStatusDraft {
		return nil, ToGRPCError(fmt.Errorf("%w: can only start voting from DRAFT or ACTIVE status", ErrInvalidStatus))
	}

	retro.Status = vstore.RetrospectiveStatusVoting
	if err := s.retroStore.Update(retro); err != nil {
		return nil, ToGRPCError(err)
	}

	return &emptypb.Empty{}, nil
}

// StartDiscussion transitions a retrospective to discussion phase
func (s *RetrospectiveService) StartDiscussion(ctx context.Context, req *pb.StartDiscussionRequest) (*emptypb.Empty, error) {
	retro, err := s.retroStore.Get(req.RetrospectiveId)
	if err != nil {
		return nil, ToGRPCError(err)
	}

	if retro.Status != vstore.RetrospectiveStatusVoting {
		return nil, ToGRPCError(fmt.Errorf("%w: can only start discussion from VOTING status", ErrInvalidStatus))
	}

	retro.Status = vstore.RetrospectiveStatusDiscussing
	if err := s.retroStore.Update(retro); err != nil {
		return nil, ToGRPCError(err)
	}

	return &emptypb.Empty{}, nil
}

// Complete marks a retrospective as complete
func (s *RetrospectiveService) Complete(ctx context.Context, req *pb.CompleteRetrospectiveRequest) (*emptypb.Empty, error) {
	retro, err := s.retroStore.Get(req.RetrospectiveId)
	if err != nil {
		return nil, ToGRPCError(err)
	}

	retro.Status = vstore.RetrospectiveStatusCompleted
	retro.CompletedAt = time.Now()
	if err := s.retroStore.Update(retro); err != nil {
		return nil, ToGRPCError(err)
	}

	return &emptypb.Empty{}, nil
}

// Export exports a retrospective to various formats
func (s *RetrospectiveService) Export(ctx context.Context, req *pb.ExportRetrospectiveRequest) (*pb.ExportRetrospectiveResponse, error) {
	retro, err := s.retroStore.Get(req.RetrospectiveId)
	if err != nil {
		return nil, ToGRPCError(err)
	}

	items, _ := s.itemStore.ListByRetrospective(req.RetrospectiveId, "", true)
	actionItems, _ := s.actionItemStore.ListByRetrospective(req.RetrospectiveId)

	var content []byte
	var filename string
	var contentType string

	switch req.Format {
	case pb.ExportFormat_EXPORT_FORMAT_JSON:
		content, filename, contentType = s.exportJSON(retro, items, actionItems)
	case pb.ExportFormat_EXPORT_FORMAT_CSV:
		content, filename, contentType = s.exportCSV(retro, items, actionItems)
	case pb.ExportFormat_EXPORT_FORMAT_MARKDOWN:
		content, filename, contentType = s.exportMarkdown(retro, items, actionItems)
	default:
		content, filename, contentType = s.exportMarkdown(retro, items, actionItems)
	}

	return &pb.ExportRetrospectiveResponse{
		Content:     content,
		Filename:    filename,
		ContentType: contentType,
	}, nil
}

func (s *RetrospectiveService) exportJSON(retro *vstore.Retrospective, items []*vstore.RetrospectiveItem, actionItems []*vstore.ActionItem) ([]byte, string, string) {
	data := map[string]interface{}{
		"retrospective": retro,
		"items":         items,
		"action_items":  actionItems,
	}
	content, _ := json.MarshalIndent(data, "", "  ")
	return content, fmt.Sprintf("%s.json", retro.SprintName), "application/json"
}

func (s *RetrospectiveService) exportCSV(retro *vstore.Retrospective, items []*vstore.RetrospectiveItem, actionItems []*vstore.ActionItem) ([]byte, string, string) {
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	// Write header
	writer.Write([]string{"Type", "Column", "Content", "Votes", "Created By"})

	// Write items
	for _, item := range items {
		writer.Write([]string{
			"Item",
			item.ColumnID,
			item.Content,
			fmt.Sprintf("%d", item.VoteCount),
			item.CreatedByName,
		})
	}

	// Write action items
	for _, ai := range actionItems {
		writer.Write([]string{
			"Action Item",
			"",
			ai.Description,
			"",
			ai.AssigneeName,
		})
	}

	writer.Flush()
	return buf.Bytes(), fmt.Sprintf("%s.csv", retro.SprintName), "text/csv"
}

func (s *RetrospectiveService) exportMarkdown(retro *vstore.Retrospective, items []*vstore.RetrospectiveItem, actionItems []*vstore.ActionItem) ([]byte, string, string) {
	var buf bytes.Buffer

	buf.WriteString(fmt.Sprintf("# %s Retrospective\n\n", retro.SprintName))
	buf.WriteString(fmt.Sprintf("**Team:** %s\n", retro.TeamName))
	buf.WriteString(fmt.Sprintf("**Date:** %s\n\n", retro.Created.Format("January 2, 2006")))

	// Group items by column
	columnItems := make(map[string][]*vstore.RetrospectiveItem)
	for _, item := range items {
		columnItems[item.ColumnID] = append(columnItems[item.ColumnID], item)
	}

	// Write each column
	for _, col := range retro.TemplateColumns {
		buf.WriteString(fmt.Sprintf("## %s %s\n\n", col.Icon, col.Name))
		for _, item := range columnItems[col.ColumnID] {
			buf.WriteString(fmt.Sprintf("- %s", item.Content))
			if item.VoteCount > 0 {
				buf.WriteString(fmt.Sprintf(" (%d votes)", item.VoteCount))
			}
			buf.WriteString("\n")
		}
		buf.WriteString("\n")
	}

	// Write action items
	if len(actionItems) > 0 {
		buf.WriteString("## Action Items\n\n")
		for _, ai := range actionItems {
			status := "⬜"
			switch ai.Status {
			case vstore.ActionItemStatusInProgress:
				status = "🔄"
			case vstore.ActionItemStatusDone:
				status = "✅"
			case vstore.ActionItemStatusWontDo:
				status = "❌"
			}
			buf.WriteString(fmt.Sprintf("- %s %s", status, ai.Description))
			if ai.AssigneeName != "" {
				buf.WriteString(fmt.Sprintf(" (@%s)", ai.AssigneeName))
			}
			buf.WriteString("\n")
		}
	}

	return buf.Bytes(), fmt.Sprintf("%s.md", retro.SprintName), "text/markdown"
}

// Helper functions

func getUserIDFromContext(ctx context.Context) string {
	// In production, extract from auth context
	return "mock-user-id"
}

func getDefaultTemplateColumns(templateType pb.RetrospectiveTemplateType) []*vstore.TemplateColumn {
	switch templateType {
	case pb.RetrospectiveTemplateType_RETROSPECTIVE_TEMPLATE_TYPE_WENT_WELL_TO_IMPROVE:
		return []*vstore.TemplateColumn{
			{ColumnID: "went_well", Name: "What Went Well", Description: "Things that worked well this sprint", Icon: "👍", SortOrder: 1, Color: "#22c55e"},
			{ColumnID: "to_improve", Name: "What To Improve", Description: "Things that could be better", Icon: "🔧", SortOrder: 2, Color: "#f59e0b"},
			{ColumnID: "action_items", Name: "Action Items", Description: "Specific actions to take", Icon: "✅", SortOrder: 3, Color: "#3b82f6"},
		}
	case pb.RetrospectiveTemplateType_RETROSPECTIVE_TEMPLATE_TYPE_START_STOP_CONTINUE:
		return []*vstore.TemplateColumn{
			{ColumnID: "start", Name: "Start", Description: "Things we should start doing", Icon: "🚀", SortOrder: 1, Color: "#22c55e"},
			{ColumnID: "stop", Name: "Stop", Description: "Things we should stop doing", Icon: "🛑", SortOrder: 2, Color: "#ef4444"},
			{ColumnID: "continue", Name: "Continue", Description: "Things we should keep doing", Icon: "➡️", SortOrder: 3, Color: "#3b82f6"},
		}
	case pb.RetrospectiveTemplateType_RETROSPECTIVE_TEMPLATE_TYPE_FOUR_LS:
		return []*vstore.TemplateColumn{
			{ColumnID: "liked", Name: "Liked", Description: "What we liked", Icon: "❤️", SortOrder: 1, Color: "#ec4899"},
			{ColumnID: "learned", Name: "Learned", Description: "What we learned", Icon: "📚", SortOrder: 2, Color: "#8b5cf6"},
			{ColumnID: "lacked", Name: "Lacked", Description: "What was lacking", Icon: "🤔", SortOrder: 3, Color: "#f59e0b"},
			{ColumnID: "longed_for", Name: "Longed For", Description: "What we wish we had", Icon: "✨", SortOrder: 4, Color: "#06b6d4"},
		}
	case pb.RetrospectiveTemplateType_RETROSPECTIVE_TEMPLATE_TYPE_MAD_SAD_GLAD:
		return []*vstore.TemplateColumn{
			{ColumnID: "mad", Name: "Mad", Description: "Things that frustrated us", Icon: "😠", SortOrder: 1, Color: "#ef4444"},
			{ColumnID: "sad", Name: "Sad", Description: "Things that disappointed us", Icon: "😢", SortOrder: 2, Color: "#6366f1"},
			{ColumnID: "glad", Name: "Glad", Description: "Things that made us happy", Icon: "😊", SortOrder: 3, Color: "#22c55e"},
		}
	default:
		return getDefaultTemplateColumns(pb.RetrospectiveTemplateType_RETROSPECTIVE_TEMPLATE_TYPE_WENT_WELL_TO_IMPROVE)
	}
}

func convertPbColumnsToVstore(cols []*pb.TemplateColumn) []*vstore.TemplateColumn {
	var result []*vstore.TemplateColumn
	for _, col := range cols {
		result = append(result, &vstore.TemplateColumn{
			ColumnID:    col.ColumnId,
			Name:        col.Name,
			Description: col.Description,
			Icon:        col.Icon,
			SortOrder:   col.SortOrder,
			Color:       col.Color,
		})
	}
	return result
}

func convertVstoreRetroToPb(retro *vstore.Retrospective) *pb.Retrospective {
	var columns []*pb.TemplateColumn
	for _, col := range retro.TemplateColumns {
		columns = append(columns, &pb.TemplateColumn{
			ColumnId:    col.ColumnID,
			Name:        col.Name,
			Description: col.Description,
			Icon:        col.Icon,
			SortOrder:   col.SortOrder,
			Color:       col.Color,
		})
	}

	return &pb.Retrospective{
		RetrospectiveId: retro.RetrospectiveID,
		TeamId:          retro.TeamID,
		TeamName:        retro.TeamName,
		SprintName:      retro.SprintName,
		Description:     retro.Description,
		Template: &pb.RetrospectiveTemplate{
			Type:    pb.RetrospectiveTemplateType(retro.TemplateType),
			Columns: columns,
		},
		Status: pb.RetrospectiveStatus(retro.Status),
		VotingConfig: &pb.VotingConfig{
			MaxVotesPerUser:           retro.VotingConfig.MaxVotesPerUser,
			AllowMultipleVotesPerItem: retro.VotingConfig.AllowMultipleVotesPerItem,
			AnonymousVoting:           retro.VotingConfig.AnonymousVoting,
		},
		Created:          timestamppb.New(retro.Created),
		Updated:          timestamppb.New(retro.Updated),
		StartedAt:        timestamppb.New(retro.StartedAt),
		CompletedAt:      timestamppb.New(retro.CompletedAt),
		CreatedBy:        retro.CreatedBy,
		FacilitatorId:    retro.FacilitatorID,
		ItemCount:        retro.ItemCount,
		ActionItemCount:  retro.ActionItemCount,
		ParticipantCount: retro.ParticipantCount,
	}
}

func convertVstoreItemToPb(item *vstore.RetrospectiveItem) *pb.RetrospectiveItem {
	return &pb.RetrospectiveItem{
		ItemId:          item.ItemID,
		RetrospectiveId: item.RetrospectiveID,
		ColumnId:        item.ColumnID,
		Content:         item.Content,
		CreatedBy:       item.CreatedBy,
		CreatedByName:   item.CreatedByName,
		VoteCount:       item.VoteCount,
		Created:         timestamppb.New(item.Created),
		Updated:         timestamppb.New(item.Updated),
		IsAnonymous:     item.IsAnonymous,
		Position:        item.Position,
		HasActionItem:   item.HasActionItem,
	}
}

func convertVstoreActionItemToPb(ai *vstore.ActionItem) *pb.ActionItem {
	return &pb.ActionItem{
		ActionItemId:     ai.ActionItemID,
		RetrospectiveId:  ai.RetrospectiveID,
		SourceItemId:     ai.SourceItemID,
		TeamId:           ai.TeamID,
		Description:      ai.Description,
		AssigneeId:       ai.AssigneeID,
		AssigneeName:     ai.AssigneeName,
		Status:           pb.ActionItemStatus(ai.Status),
		Priority:         pb.ActionItemPriority(ai.Priority),
		DueDate:          timestamppb.New(ai.DueDate),
		Created:          timestamppb.New(ai.Created),
		Updated:          timestamppb.New(ai.Updated),
		CreatedBy:        ai.CreatedBy,
		SourceSprintName: ai.SourceSprintName,
		Notes:            ai.Notes,
	}
}
