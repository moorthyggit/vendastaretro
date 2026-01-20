package api

import (
	"context"
	"fmt"
	"sort"
	"time"

	"google.golang.org/protobuf/types/known/emptypb"

	pb "github.com/vendasta/generated-protos-go/retrospective/v1"
	"github.com/vendasta/retrospective/internal/vstore"
)

// VotingService implements the VotingService gRPC service
type VotingService struct {
	pb.UnimplementedVotingServiceServer
	voteStore  *InMemoryVoteStore
	itemStore  *InMemoryItemStore
	retroStore *InMemoryRetrospectiveStore
}

// NewVotingService creates a new VotingService
func NewVotingService(
	voteStore *InMemoryVoteStore,
	itemStore *InMemoryItemStore,
	retroStore *InMemoryRetrospectiveStore,
) *VotingService {
	return &VotingService{
		voteStore:  voteStore,
		itemStore:  itemStore,
		retroStore: retroStore,
	}
}

// CastVote casts a vote for an item
func (s *VotingService) CastVote(ctx context.Context, req *pb.CastVoteRequest) (*emptypb.Empty, error) {
	if req.RetrospectiveId == "" {
		return nil, ToGRPCError(fmt.Errorf("%w: retrospective_id is required", ErrInvalidArgument))
	}
	if req.ItemId == "" {
		return nil, ToGRPCError(fmt.Errorf("%w: item_id is required", ErrInvalidArgument))
	}

	// Get retrospective to check voting config
	retro, err := s.retroStore.Get(req.RetrospectiveId)
	if err != nil {
		return nil, ToGRPCError(err)
	}

	// Verify retrospective is in voting phase
	if retro.Status != vstore.RetrospectiveStatusVoting && retro.Status != vstore.RetrospectiveStatusActive {
		return nil, ToGRPCError(fmt.Errorf("%w: voting is not currently allowed", ErrInvalidStatus))
	}

	// Verify item exists and belongs to this retrospective
	item, err := s.itemStore.Get(req.ItemId)
	if err != nil {
		return nil, ToGRPCError(err)
	}
	if item.RetrospectiveID != req.RetrospectiveId {
		return nil, ToGRPCError(fmt.Errorf("%w: item does not belong to this retrospective", ErrInvalidArgument))
	}

	userID := getUserIDFromContext(ctx)

	// Check if user has already voted for this item
	existingVote, _ := s.voteStore.GetByUserAndItem(req.RetrospectiveId, req.ItemId, userID)
	if existingVote != nil && !retro.VotingConfig.AllowMultipleVotesPerItem {
		return nil, ToGRPCError(fmt.Errorf("%w: you have already voted for this item", ErrAlreadyExists))
	}

	// Check vote limit
	currentVotes, _ := s.voteStore.CountByUser(req.RetrospectiveId, userID)
	if int32(currentVotes) >= retro.VotingConfig.MaxVotesPerUser {
		return nil, ToGRPCError(fmt.Errorf("%w: you have used all %d votes", ErrVoteLimitExceeded, retro.VotingConfig.MaxVotesPerUser))
	}

	// Create vote
	voteID := fmt.Sprintf("VOTE-%d", time.Now().UnixNano())
	vote := &vstore.Vote{
		VoteID:          voteID,
		RetrospectiveID: req.RetrospectiveId,
		ItemID:          req.ItemId,
		UserID:          userID,
	}

	if err := s.voteStore.Create(vote); err != nil {
		return nil, ToGRPCError(err)
	}

	// Increment vote count on item
	if err := s.itemStore.IncrementVoteCount(req.ItemId); err != nil {
		// Rollback vote creation
		s.voteStore.Delete(voteID)
		return nil, ToGRPCError(err)
	}

	return &emptypb.Empty{}, nil
}

// RemoveVote removes a vote from an item
func (s *VotingService) RemoveVote(ctx context.Context, req *pb.RemoveVoteRequest) (*emptypb.Empty, error) {
	if req.RetrospectiveId == "" {
		return nil, ToGRPCError(fmt.Errorf("%w: retrospective_id is required", ErrInvalidArgument))
	}
	if req.ItemId == "" {
		return nil, ToGRPCError(fmt.Errorf("%w: item_id is required", ErrInvalidArgument))
	}

	userID := getUserIDFromContext(ctx)

	// Find the vote
	vote, err := s.voteStore.GetByUserAndItem(req.RetrospectiveId, req.ItemId, userID)
	if err != nil {
		return nil, ToGRPCError(fmt.Errorf("%w: you have not voted for this item", ErrNotFound))
	}

	// Delete vote
	if err := s.voteStore.Delete(vote.VoteID); err != nil {
		return nil, ToGRPCError(err)
	}

	// Decrement vote count on item
	s.itemStore.DecrementVoteCount(req.ItemId)

	return &emptypb.Empty{}, nil
}

// GetVoteSummary gets vote summary for all items in a retrospective
func (s *VotingService) GetVoteSummary(ctx context.Context, req *pb.GetVoteSummaryRequest) (*pb.GetVoteSummaryResponse, error) {
	if req.RetrospectiveId == "" {
		return nil, ToGRPCError(fmt.Errorf("%w: retrospective_id is required", ErrInvalidArgument))
	}

	userID := getUserIDFromContext(ctx)

	// Get all items
	items, err := s.itemStore.ListByRetrospective(req.RetrospectiveId, "", false)
	if err != nil {
		return nil, ToGRPCError(err)
	}

	// Get user's votes
	userVotes, _ := s.voteStore.ListByUser(req.RetrospectiveId, userID)
	userVotedItems := make(map[string]bool)
	for _, vote := range userVotes {
		userVotedItems[vote.ItemID] = true
	}

	// Create summaries and sort by vote count for ranking
	type itemVote struct {
		itemID    string
		voteCount int32
	}
	var itemVotes []itemVote
	for _, item := range items {
		itemVotes = append(itemVotes, itemVote{
			itemID:    item.ItemID,
			voteCount: item.VoteCount,
		})
	}

	// Sort by vote count descending
	sort.Slice(itemVotes, func(i, j int) bool {
		return itemVotes[i].voteCount > itemVotes[j].voteCount
	})

	// Create rank map
	rankMap := make(map[string]int32)
	currentRank := int32(1)
	lastVoteCount := int32(-1)
	for i, iv := range itemVotes {
		if iv.voteCount != lastVoteCount {
			currentRank = int32(i + 1)
			lastVoteCount = iv.voteCount
		}
		rankMap[iv.itemID] = currentRank
	}

	// Build response
	var summaries []*pb.VoteSummary
	totalVotes := int32(0)
	for _, item := range items {
		summaries = append(summaries, &pb.VoteSummary{
			ItemId:           item.ItemID,
			VoteCount:        item.VoteCount,
			Rank:             rankMap[item.ItemID],
			CurrentUserVoted: userVotedItems[item.ItemID],
		})
		totalVotes += item.VoteCount
	}

	return &pb.GetVoteSummaryResponse{
		Summaries:  summaries,
		TotalVotes: totalVotes,
	}, nil
}

// GetUserVotes gets a user's votes in a retrospective
func (s *VotingService) GetUserVotes(ctx context.Context, req *pb.GetUserVotesRequest) (*pb.GetUserVotesResponse, error) {
	if req.RetrospectiveId == "" {
		return nil, ToGRPCError(fmt.Errorf("%w: retrospective_id is required", ErrInvalidArgument))
	}

	userID := req.UserId
	if userID == "" {
		userID = getUserIDFromContext(ctx)
	}

	// Get retrospective for vote limit
	retro, err := s.retroStore.Get(req.RetrospectiveId)
	if err != nil {
		return nil, ToGRPCError(err)
	}

	// Get user's votes
	votes, err := s.voteStore.ListByUser(req.RetrospectiveId, userID)
	if err != nil {
		return nil, ToGRPCError(err)
	}

	var votedItemIDs []string
	for _, vote := range votes {
		votedItemIDs = append(votedItemIDs, vote.ItemID)
	}

	votesCast := int32(len(votes))
	votesRemaining := retro.VotingConfig.MaxVotesPerUser - votesCast
	if votesRemaining < 0 {
		votesRemaining = 0
	}

	return &pb.GetUserVotesResponse{
		Summary: &pb.UserVoteSummary{
			UserId:         userID,
			VotesCast:      votesCast,
			VotesRemaining: votesRemaining,
			VotedItemIds:   votedItemIDs,
		},
	}, nil
}
