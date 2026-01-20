package api

import (
	"context"
	"fmt"
	"time"

	"google.golang.org/protobuf/types/known/emptypb"

	pb "github.com/vendasta/generated-protos-go/retrospective/v1"
	"github.com/vendasta/retrospective/internal/vstore"
)

// RetrospectiveItemService implements the RetrospectiveItemService gRPC service
type RetrospectiveItemService struct {
	pb.UnimplementedRetrospectiveItemServiceServer
	itemStore  *InMemoryItemStore
	retroStore *InMemoryRetrospectiveStore
}

// NewRetrospectiveItemService creates a new RetrospectiveItemService
func NewRetrospectiveItemService(
	itemStore *InMemoryItemStore,
	retroStore *InMemoryRetrospectiveStore,
) *RetrospectiveItemService {
	return &RetrospectiveItemService{
		itemStore:  itemStore,
		retroStore: retroStore,
	}
}

// Create creates a new item on the board
func (s *RetrospectiveItemService) Create(ctx context.Context, req *pb.CreateItemRequest) (*pb.CreateItemResponse, error) {
	if req.RetrospectiveId == "" {
		return nil, ToGRPCError(fmt.Errorf("%w: retrospective_id is required", ErrInvalidArgument))
	}
	if req.ColumnId == "" {
		return nil, ToGRPCError(fmt.Errorf("%w: column_id is required", ErrInvalidArgument))
	}
	if req.Content == "" {
		return nil, ToGRPCError(fmt.Errorf("%w: content is required", ErrInvalidArgument))
	}

	// Verify retrospective exists
	retro, err := s.retroStore.Get(req.RetrospectiveId)
	if err != nil {
		return nil, ToGRPCError(err)
	}

	// Verify column exists in template
	columnValid := false
	for _, col := range retro.TemplateColumns {
		if col.ColumnID == req.ColumnId {
			columnValid = true
			break
		}
	}
	if !columnValid {
		return nil, ToGRPCError(fmt.Errorf("%w: invalid column_id", ErrInvalidArgument))
	}

	// Get next position
	existingItems, _ := s.itemStore.ListByRetrospective(req.RetrospectiveId, req.ColumnId, false)
	position := int32(len(existingItems))

	userID := getUserIDFromContext(ctx)
	userName := "Anonymous"
	if !req.IsAnonymous {
		userName = getUserNameFromContext(ctx)
	}

	// Generate ID
	itemID := fmt.Sprintf("ITEM-%d", time.Now().UnixNano())

	item := &vstore.RetrospectiveItem{
		ItemID:          itemID,
		RetrospectiveID: req.RetrospectiveId,
		ColumnID:        req.ColumnId,
		Content:         req.Content,
		CreatedBy:       userID,
		CreatedByName:   userName,
		VoteCount:       0,
		IsAnonymous:     req.IsAnonymous,
		Position:        position,
		HasActionItem:   false,
	}

	if err := s.itemStore.Create(item); err != nil {
		return nil, ToGRPCError(err)
	}

	// Update item count on retrospective
	retro.ItemCount++
	s.retroStore.Update(retro)

	return &pb.CreateItemResponse{
		Item: convertVstoreItemToPb(item),
	}, nil
}

// Update updates an existing item
func (s *RetrospectiveItemService) Update(ctx context.Context, req *pb.UpdateItemRequest) (*emptypb.Empty, error) {
	if req.Item == nil || req.Item.ItemId == "" {
		return nil, ToGRPCError(fmt.Errorf("%w: item is required", ErrInvalidArgument))
	}

	existing, err := s.itemStore.Get(req.Item.ItemId)
	if err != nil {
		return nil, ToGRPCError(err)
	}

	// Update allowed fields
	if req.Item.Content != "" {
		existing.Content = req.Item.Content
	}

	if err := s.itemStore.Update(existing); err != nil {
		return nil, ToGRPCError(err)
	}

	return &emptypb.Empty{}, nil
}

// Delete deletes an item
func (s *RetrospectiveItemService) Delete(ctx context.Context, req *pb.DeleteItemRequest) (*emptypb.Empty, error) {
	if req.ItemId == "" {
		return nil, ToGRPCError(fmt.Errorf("%w: item_id is required", ErrInvalidArgument))
	}

	item, err := s.itemStore.Get(req.ItemId)
	if err != nil {
		return nil, ToGRPCError(err)
	}

	// Verify retrospective ID matches
	if req.RetrospectiveId != "" && item.RetrospectiveID != req.RetrospectiveId {
		return nil, ToGRPCError(fmt.Errorf("%w: item does not belong to this retrospective", ErrInvalidArgument))
	}

	if err := s.itemStore.Delete(req.ItemId); err != nil {
		return nil, ToGRPCError(err)
	}

	// Update item count on retrospective
	retro, err := s.retroStore.Get(item.RetrospectiveID)
	if err == nil {
		retro.ItemCount--
		s.retroStore.Update(retro)
	}

	return &emptypb.Empty{}, nil
}

// List lists items in a retrospective
func (s *RetrospectiveItemService) List(ctx context.Context, req *pb.ListItemsRequest) (*pb.ListItemsResponse, error) {
	if req.RetrospectiveId == "" {
		return nil, ToGRPCError(fmt.Errorf("%w: retrospective_id is required", ErrInvalidArgument))
	}

	items, err := s.itemStore.ListByRetrospective(req.RetrospectiveId, req.ColumnId, req.SortByVotes)
	if err != nil {
		return nil, ToGRPCError(err)
	}

	var pbItems []*pb.RetrospectiveItem
	for _, item := range items {
		pbItems = append(pbItems, convertVstoreItemToPb(item))
	}

	return &pb.ListItemsResponse{
		Items: pbItems,
	}, nil
}

// MoveToColumn moves an item to a different column
func (s *RetrospectiveItemService) MoveToColumn(ctx context.Context, req *pb.MoveItemToColumnRequest) (*emptypb.Empty, error) {
	if req.ItemId == "" {
		return nil, ToGRPCError(fmt.Errorf("%w: item_id is required", ErrInvalidArgument))
	}
	if req.TargetColumnId == "" {
		return nil, ToGRPCError(fmt.Errorf("%w: target_column_id is required", ErrInvalidArgument))
	}

	item, err := s.itemStore.Get(req.ItemId)
	if err != nil {
		return nil, ToGRPCError(err)
	}

	// Verify retrospective ID matches
	if req.RetrospectiveId != "" && item.RetrospectiveID != req.RetrospectiveId {
		return nil, ToGRPCError(fmt.Errorf("%w: item does not belong to this retrospective", ErrInvalidArgument))
	}

	// Verify target column exists
	retro, err := s.retroStore.Get(item.RetrospectiveID)
	if err != nil {
		return nil, ToGRPCError(err)
	}

	columnValid := false
	for _, col := range retro.TemplateColumns {
		if col.ColumnID == req.TargetColumnId {
			columnValid = true
			break
		}
	}
	if !columnValid {
		return nil, ToGRPCError(fmt.Errorf("%w: invalid target_column_id", ErrInvalidArgument))
	}

	item.ColumnID = req.TargetColumnId
	item.Position = req.Position

	if err := s.itemStore.Update(item); err != nil {
		return nil, ToGRPCError(err)
	}

	return &emptypb.Empty{}, nil
}

func getUserNameFromContext(ctx context.Context) string {
	// In production, extract from auth context
	return "Mock User"
}
