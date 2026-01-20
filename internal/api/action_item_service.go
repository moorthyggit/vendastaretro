package api

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/protobuf/types/known/emptypb"

	pb "github.com/vendasta/generated-protos-go/retrospective/v1"
	"github.com/vendasta/retrospective/internal/vstore"
)

// ActionItemService implements the ActionItemService gRPC service
type ActionItemService struct {
	pb.UnimplementedActionItemServiceServer
	actionItemStore *InMemoryActionItemStore
	retroStore      *InMemoryRetrospectiveStore
}

// NewActionItemService creates a new ActionItemService
func NewActionItemService(
	actionItemStore *InMemoryActionItemStore,
	retroStore *InMemoryRetrospectiveStore,
) *ActionItemService {
	return &ActionItemService{
		actionItemStore: actionItemStore,
		retroStore:      retroStore,
	}
}

// Create creates a new action item
func (s *ActionItemService) Create(ctx context.Context, req *pb.CreateActionItemRequest) (*pb.CreateActionItemResponse, error) {
	if req.Description == "" {
		return nil, ToGRPCError(fmt.Errorf("%w: description is required", ErrInvalidArgument))
	}

	// Get retrospective for context
	var retro *vstore.Retrospective
	if req.RetrospectiveId != "" {
		var err error
		retro, err = s.retroStore.Get(req.RetrospectiveId)
		if err != nil {
			return nil, ToGRPCError(err)
		}
	}

	teamID := req.TeamId
	if teamID == "" && retro != nil {
		teamID = retro.TeamID
	}
	if teamID == "" {
		return nil, ToGRPCError(fmt.Errorf("%w: team_id is required", ErrInvalidArgument))
	}

	// Generate ID
	actionItemID := fmt.Sprintf("ACTION-%d", time.Now().UnixNano())

	actionItem := &vstore.ActionItem{
		ActionItemID:    actionItemID,
		RetrospectiveID: req.RetrospectiveId,
		SourceItemID:    req.SourceItemId,
		TeamID:          teamID,
		Description:     req.Description,
		AssigneeID:      req.AssigneeId,
		AssigneeName:    getAssigneeName(req.AssigneeId),
		Status:          vstore.ActionItemStatusNotStarted,
		Priority:        vstore.ActionItemPriority(req.Priority),
		CreatedBy:       getUserIDFromContext(ctx),
	}

	if req.DueDate != nil {
		actionItem.DueDate = req.DueDate.AsTime()
	}

	if retro != nil {
		actionItem.SourceSprintName = retro.SprintName
	}

	// Default priority if not set
	if actionItem.Priority == vstore.ActionItemPriorityUnspecified {
		actionItem.Priority = vstore.ActionItemPriorityMedium
	}

	if err := s.actionItemStore.Create(actionItem); err != nil {
		return nil, ToGRPCError(err)
	}

	// Update action item count on retrospective
	if retro != nil {
		retro.ActionItemCount++
		s.retroStore.Update(retro)
	}

	return &pb.CreateActionItemResponse{
		ActionItem: convertVstoreActionItemToPb(actionItem),
	}, nil
}

// Update updates an action item
func (s *ActionItemService) Update(ctx context.Context, req *pb.UpdateActionItemRequest) (*emptypb.Empty, error) {
	if req.ActionItem == nil || req.ActionItem.ActionItemId == "" {
		return nil, ToGRPCError(fmt.Errorf("%w: action_item is required", ErrInvalidArgument))
	}

	existing, err := s.actionItemStore.Get(req.ActionItem.ActionItemId)
	if err != nil {
		return nil, ToGRPCError(err)
	}

	// Update allowed fields based on field mask (simplified)
	if req.ActionItem.Description != "" {
		existing.Description = req.ActionItem.Description
	}
	if req.ActionItem.AssigneeId != "" {
		existing.AssigneeID = req.ActionItem.AssigneeId
		existing.AssigneeName = getAssigneeName(req.ActionItem.AssigneeId)
	}
	if req.ActionItem.Status != pb.ActionItemStatus_ACTION_ITEM_STATUS_UNSPECIFIED {
		existing.Status = vstore.ActionItemStatus(req.ActionItem.Status)
	}
	if req.ActionItem.Priority != pb.ActionItemPriority_ACTION_ITEM_PRIORITY_UNSPECIFIED {
		existing.Priority = vstore.ActionItemPriority(req.ActionItem.Priority)
	}
	if req.ActionItem.DueDate != nil {
		existing.DueDate = req.ActionItem.DueDate.AsTime()
	}
	if req.ActionItem.Notes != "" {
		existing.Notes = req.ActionItem.Notes
	}

	if err := s.actionItemStore.Update(existing); err != nil {
		return nil, ToGRPCError(err)
	}

	return &emptypb.Empty{}, nil
}

// UpdateStatus updates just the status of an action item
func (s *ActionItemService) UpdateStatus(ctx context.Context, req *pb.UpdateActionItemStatusRequest) (*emptypb.Empty, error) {
	if req.ActionItemId == "" {
		return nil, ToGRPCError(fmt.Errorf("%w: action_item_id is required", ErrInvalidArgument))
	}

	existing, err := s.actionItemStore.Get(req.ActionItemId)
	if err != nil {
		return nil, ToGRPCError(err)
	}

	existing.Status = vstore.ActionItemStatus(req.Status)
	if req.Notes != "" {
		existing.Notes = req.Notes
	}

	if err := s.actionItemStore.Update(existing); err != nil {
		return nil, ToGRPCError(err)
	}

	return &emptypb.Empty{}, nil
}

// Delete deletes an action item
func (s *ActionItemService) Delete(ctx context.Context, req *pb.DeleteActionItemRequest) (*emptypb.Empty, error) {
	if req.ActionItemId == "" {
		return nil, ToGRPCError(fmt.Errorf("%w: action_item_id is required", ErrInvalidArgument))
	}

	// Get action item first to update retrospective count
	actionItem, err := s.actionItemStore.Get(req.ActionItemId)
	if err != nil {
		return nil, ToGRPCError(err)
	}

	if err := s.actionItemStore.Delete(req.ActionItemId); err != nil {
		return nil, ToGRPCError(err)
	}

	// Update action item count on retrospective
	if actionItem.RetrospectiveID != "" {
		retro, err := s.retroStore.Get(actionItem.RetrospectiveID)
		if err == nil {
			retro.ActionItemCount--
			s.retroStore.Update(retro)
		}
	}

	return &emptypb.Empty{}, nil
}

// List lists action items with filters
func (s *ActionItemService) List(ctx context.Context, req *pb.ListActionItemsRequest) (*pb.ListActionItemsResponse, error) {
	var actionItems []*vstore.ActionItem
	var err error

	if req.Filters != nil && req.Filters.RetrospectiveId != "" {
		actionItems, err = s.actionItemStore.ListByRetrospective(req.Filters.RetrospectiveId)
	} else if req.Filters != nil && req.Filters.TeamId != "" {
		actionItems, err = s.actionItemStore.ListByTeam(req.Filters.TeamId, true)
	} else {
		return nil, ToGRPCError(fmt.Errorf("%w: either retrospective_id or team_id filter is required", ErrInvalidArgument))
	}

	if err != nil {
		return nil, ToGRPCError(err)
	}

	// Apply additional filters
	var filtered []*vstore.ActionItem
	for _, ai := range actionItems {
		// Filter by assignee
		if req.Filters != nil && req.Filters.AssigneeId != "" && ai.AssigneeID != req.Filters.AssigneeId {
			continue
		}

		// Filter by status
		if req.Filters != nil && len(req.Filters.Statuses) > 0 {
			found := false
			for _, status := range req.Filters.Statuses {
				if ai.Status == vstore.ActionItemStatus(status) {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}

		// Filter by priority
		if req.Filters != nil && len(req.Filters.Priorities) > 0 {
			found := false
			for _, priority := range req.Filters.Priorities {
				if ai.Priority == vstore.ActionItemPriority(priority) {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}

		filtered = append(filtered, ai)
	}

	var pbActionItems []*pb.ActionItem
	for _, ai := range filtered {
		pbActionItems = append(pbActionItems, convertVstoreActionItemToPb(ai))
	}

	return &pb.ListActionItemsResponse{
		ActionItems: pbActionItems,
		PagingMetadata: &pb.ListActionItemsResponse_PagingMetadata{
			HasMore: false,
		},
	}, nil
}

// ListByTeam lists all action items for a team across retrospectives
func (s *ActionItemService) ListByTeam(ctx context.Context, req *pb.ListActionItemsByTeamRequest) (*pb.ListActionItemsResponse, error) {
	if req.TeamId == "" {
		return nil, ToGRPCError(fmt.Errorf("%w: team_id is required", ErrInvalidArgument))
	}

	actionItems, err := s.actionItemStore.ListByTeam(req.TeamId, req.IncludeCompleted)
	if err != nil {
		return nil, ToGRPCError(err)
	}

	var pbActionItems []*pb.ActionItem
	for _, ai := range actionItems {
		pbActionItems = append(pbActionItems, convertVstoreActionItemToPb(ai))
	}

	return &pb.ListActionItemsResponse{
		ActionItems: pbActionItems,
		PagingMetadata: &pb.ListActionItemsResponse_PagingMetadata{
			HasMore: false,
		},
	}, nil
}

func getAssigneeName(assigneeID string) string {
	// In production, look up user name from IAM
	if assigneeID == "" {
		return ""
	}
	return "Team Member"
}
