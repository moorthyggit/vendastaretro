package api

import (
	"context"
	"fmt"
	"sync"
	"time"

	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	pb "github.com/vendasta/generated-protos-go/retrospective/v1"
	"github.com/vendasta/retrospective/internal/vstore"
)

// EventBroadcaster manages real-time event broadcasting
type EventBroadcaster struct {
	mu          sync.RWMutex
	subscribers map[string][]chan *pb.RetrospectiveEvent // key: retrospective_id
}

// NewEventBroadcaster creates a new EventBroadcaster
func NewEventBroadcaster() *EventBroadcaster {
	return &EventBroadcaster{
		subscribers: make(map[string][]chan *pb.RetrospectiveEvent),
	}
}

// Subscribe adds a subscriber for a retrospective
func (b *EventBroadcaster) Subscribe(retroID string) chan *pb.RetrospectiveEvent {
	b.mu.Lock()
	defer b.mu.Unlock()

	ch := make(chan *pb.RetrospectiveEvent, 100)
	b.subscribers[retroID] = append(b.subscribers[retroID], ch)
	return ch
}

// Unsubscribe removes a subscriber
func (b *EventBroadcaster) Unsubscribe(retroID string, ch chan *pb.RetrospectiveEvent) {
	b.mu.Lock()
	defer b.mu.Unlock()

	subs := b.subscribers[retroID]
	for i, sub := range subs {
		if sub == ch {
			b.subscribers[retroID] = append(subs[:i], subs[i+1:]...)
			close(ch)
			break
		}
	}
}

// Broadcast sends an event to all subscribers of a retrospective
func (b *EventBroadcaster) Broadcast(retroID string, event *pb.RetrospectiveEvent) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	for _, ch := range b.subscribers[retroID] {
		select {
		case ch <- event:
		default:
			// Channel full, skip
		}
	}
}

// Global broadcaster instance
var broadcaster = NewEventBroadcaster()

// RealtimeService implements the RealtimeService gRPC service
type RealtimeService struct {
	pb.UnimplementedRealtimeServiceServer
	participantStore *InMemoryParticipantStore
	retroStore       *InMemoryRetrospectiveStore
}

// NewRealtimeService creates a new RealtimeService
func NewRealtimeService(
	participantStore *InMemoryParticipantStore,
	retroStore *InMemoryRetrospectiveStore,
) *RealtimeService {
	return &RealtimeService{
		participantStore: participantStore,
		retroStore:       retroStore,
	}
}

// Subscribe subscribes to real-time updates for a retrospective
func (s *RealtimeService) Subscribe(req *pb.SubscribeRequest, stream pb.RealtimeService_SubscribeServer) error {
	if req.RetrospectiveId == "" {
		return ToGRPCError(fmt.Errorf("%w: retrospective_id is required", ErrInvalidArgument))
	}

	// Verify retrospective exists
	_, err := s.retroStore.Get(req.RetrospectiveId)
	if err != nil {
		return ToGRPCError(err)
	}

	// Subscribe to events
	ch := broadcaster.Subscribe(req.RetrospectiveId)
	defer broadcaster.Unsubscribe(req.RetrospectiveId, ch)

	// Stream events until client disconnects
	for {
		select {
		case event, ok := <-ch:
			if !ok {
				return nil
			}
			if err := stream.Send(event); err != nil {
				return err
			}
		case <-stream.Context().Done():
			return stream.Context().Err()
		}
	}
}

// JoinRetrospective joins a retrospective session
func (s *RealtimeService) JoinRetrospective(ctx context.Context, req *pb.JoinRetrospectiveRequest) (*pb.JoinRetrospectiveResponse, error) {
	if req.RetrospectiveId == "" {
		return nil, ToGRPCError(fmt.Errorf("%w: retrospective_id is required", ErrInvalidArgument))
	}

	// Verify retrospective exists
	retro, err := s.retroStore.Get(req.RetrospectiveId)
	if err != nil {
		return nil, ToGRPCError(err)
	}

	userID := getUserIDFromContext(ctx)
	displayName := req.DisplayName
	if displayName == "" {
		displayName = getUserNameFromContext(ctx)
	}

	// Determine role
	role := vstore.ParticipantRoleMember
	if retro.FacilitatorID == userID {
		role = vstore.ParticipantRoleFacilitator
	}

	participant := &vstore.Participant{
		ParticipantID:   fmt.Sprintf("%s:%s", req.RetrospectiveId, userID),
		RetrospectiveID: req.RetrospectiveId,
		UserID:          userID,
		DisplayName:     displayName,
		AvatarURL:       req.AvatarUrl,
		Role:            role,
	}

	if err := s.participantStore.Join(participant); err != nil {
		return nil, ToGRPCError(err)
	}

	// Get all participants
	participants, _ := s.participantStore.ListByRetrospective(req.RetrospectiveId)

	// Broadcast join event
	broadcaster.Broadcast(req.RetrospectiveId, &pb.RetrospectiveEvent{
		RetrospectiveId: req.RetrospectiveId,
		Timestamp:       timestamppb.Now(),
		Event: &pb.RetrospectiveEvent_ParticipantJoined{
			ParticipantJoined: &pb.ParticipantJoinedEvent{
				Participant:      convertVstoreParticipantToPb(participant),
				ParticipantCount: int32(len(participants)),
			},
		},
	})

	// Update participant count on retrospective
	retro.ParticipantCount = int32(len(participants))
	s.retroStore.Update(retro)

	return &pb.JoinRetrospectiveResponse{
		Presence:           convertPresenceInfo(participants),
		CurrentParticipant: convertVstoreParticipantToPb(participant),
	}, nil
}

// LeaveRetrospective leaves a retrospective session
func (s *RealtimeService) LeaveRetrospective(ctx context.Context, req *pb.LeaveRetrospectiveRequest) (*emptypb.Empty, error) {
	if req.RetrospectiveId == "" {
		return nil, ToGRPCError(fmt.Errorf("%w: retrospective_id is required", ErrInvalidArgument))
	}

	userID := getUserIDFromContext(ctx)

	if err := s.participantStore.Leave(req.RetrospectiveId, userID); err != nil {
		return nil, ToGRPCError(err)
	}

	// Get remaining participants
	participants, _ := s.participantStore.ListByRetrospective(req.RetrospectiveId)

	// Broadcast leave event
	broadcaster.Broadcast(req.RetrospectiveId, &pb.RetrospectiveEvent{
		RetrospectiveId: req.RetrospectiveId,
		Timestamp:       timestamppb.Now(),
		Event: &pb.RetrospectiveEvent_ParticipantLeft{
			ParticipantLeft: &pb.ParticipantLeftEvent{
				UserId:           userID,
				ParticipantCount: int32(len(participants)),
			},
		},
	})

	// Update participant count on retrospective
	retro, err := s.retroStore.Get(req.RetrospectiveId)
	if err == nil {
		retro.ParticipantCount = int32(len(participants))
		s.retroStore.Update(retro)
	}

	return &emptypb.Empty{}, nil
}

// GetParticipants gets current participants
func (s *RealtimeService) GetParticipants(ctx context.Context, req *pb.GetParticipantsRequest) (*pb.GetParticipantsResponse, error) {
	if req.RetrospectiveId == "" {
		return nil, ToGRPCError(fmt.Errorf("%w: retrospective_id is required", ErrInvalidArgument))
	}

	participants, err := s.participantStore.ListByRetrospective(req.RetrospectiveId)
	if err != nil {
		return nil, ToGRPCError(err)
	}

	return &pb.GetParticipantsResponse{
		Presence: convertPresenceInfo(participants),
	}, nil
}

// Heartbeat keeps the presence alive
func (s *RealtimeService) Heartbeat(ctx context.Context, req *pb.HeartbeatRequest) (*emptypb.Empty, error) {
	if req.RetrospectiveId == "" {
		return nil, ToGRPCError(fmt.Errorf("%w: retrospective_id is required", ErrInvalidArgument))
	}

	userID := getUserIDFromContext(ctx)

	if err := s.participantStore.Heartbeat(req.RetrospectiveId, userID); err != nil {
		return nil, ToGRPCError(err)
	}

	return &emptypb.Empty{}, nil
}

// BroadcastItemCreated broadcasts an item created event
func BroadcastItemCreated(retroID string, item *pb.RetrospectiveItem) {
	broadcaster.Broadcast(retroID, &pb.RetrospectiveEvent{
		RetrospectiveId: retroID,
		Timestamp:       timestamppb.Now(),
		Event: &pb.RetrospectiveEvent_ItemCreated{
			ItemCreated: &pb.ItemCreatedEvent{
				Item: item,
			},
		},
	})
}

// BroadcastItemUpdated broadcasts an item updated event
func BroadcastItemUpdated(retroID string, item *pb.RetrospectiveItem) {
	broadcaster.Broadcast(retroID, &pb.RetrospectiveEvent{
		RetrospectiveId: retroID,
		Timestamp:       timestamppb.Now(),
		Event: &pb.RetrospectiveEvent_ItemUpdated{
			ItemUpdated: &pb.ItemUpdatedEvent{
				Item: item,
			},
		},
	})
}

// BroadcastItemDeleted broadcasts an item deleted event
func BroadcastItemDeleted(retroID, itemID, columnID string) {
	broadcaster.Broadcast(retroID, &pb.RetrospectiveEvent{
		RetrospectiveId: retroID,
		Timestamp:       timestamppb.Now(),
		Event: &pb.RetrospectiveEvent_ItemDeleted{
			ItemDeleted: &pb.ItemDeletedEvent{
				ItemId:   itemID,
				ColumnId: columnID,
			},
		},
	})
}

// BroadcastVoteCast broadcasts a vote cast event
func BroadcastVoteCast(retroID, itemID string, newVoteCount int32, userID string) {
	broadcaster.Broadcast(retroID, &pb.RetrospectiveEvent{
		RetrospectiveId: retroID,
		Timestamp:       timestamppb.Now(),
		Event: &pb.RetrospectiveEvent_VoteCast{
			VoteCast: &pb.VoteCastEvent{
				ItemId:       itemID,
				NewVoteCount: newVoteCount,
				UserId:       userID,
			},
		},
	})
}

// BroadcastStatusChanged broadcasts a status changed event
func BroadcastStatusChanged(retroID string, prevStatus, newStatus pb.RetrospectiveStatus, changedBy string) {
	broadcaster.Broadcast(retroID, &pb.RetrospectiveEvent{
		RetrospectiveId: retroID,
		Timestamp:       timestamppb.Now(),
		Event: &pb.RetrospectiveEvent_StatusChanged{
			StatusChanged: &pb.StatusChangedEvent{
				PreviousStatus: prevStatus,
				NewStatus:      newStatus,
				ChangedBy:      changedBy,
			},
		},
	})
}

func convertVstoreParticipantToPb(p *vstore.Participant) *pb.Participant {
	return &pb.Participant{
		UserId:      p.UserID,
		DisplayName: p.DisplayName,
		AvatarUrl:   p.AvatarURL,
		JoinedAt:    timestamppb.New(p.JoinedAt),
		Role:        pb.ParticipantRole(p.Role),
		LastActive:  timestamppb.New(p.LastActive),
		IsOnline:    p.IsOnline,
	}
}

func convertPresenceInfo(participants []*vstore.Participant) *pb.PresenceInfo {
	var pbParticipants []*pb.Participant
	for _, p := range participants {
		pbParticipants = append(pbParticipants, convertVstoreParticipantToPb(p))
	}
	return &pb.PresenceInfo{
		ParticipantCount: int32(len(participants)),
		Participants:     pbParticipants,
	}
}
