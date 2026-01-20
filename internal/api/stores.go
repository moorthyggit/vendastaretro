package api

import (
	"sync"
	"time"

	"github.com/vendasta/retrospective/internal/vstore"
)

// InMemoryRetrospectiveStore provides in-memory storage for retrospectives
// In production, this would be backed by vstore
type InMemoryRetrospectiveStore struct {
	mu     sync.RWMutex
	retros map[string]*vstore.Retrospective // key: retrospective_id
}

func NewInMemoryRetrospectiveStore() *InMemoryRetrospectiveStore {
	return &InMemoryRetrospectiveStore{
		retros: make(map[string]*vstore.Retrospective),
	}
}

func (s *InMemoryRetrospectiveStore) Create(retro *vstore.Retrospective) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	retro.Created = time.Now()
	retro.Updated = time.Now()
	s.retros[retro.RetrospectiveID] = retro
	return nil
}

func (s *InMemoryRetrospectiveStore) Get(id string) (*vstore.Retrospective, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if retro, ok := s.retros[id]; ok {
		return retro, nil
	}
	return nil, ErrNotFound
}

func (s *InMemoryRetrospectiveStore) Update(retro *vstore.Retrospective) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	retro.Updated = time.Now()
	s.retros[retro.RetrospectiveID] = retro
	return nil
}

func (s *InMemoryRetrospectiveStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.retros, id)
	return nil
}

func (s *InMemoryRetrospectiveStore) List(teamID string, statuses []vstore.RetrospectiveStatus, cursor string, pageSize int) ([]*vstore.Retrospective, string, bool, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var results []*vstore.Retrospective
	for _, retro := range s.retros {
		if teamID != "" && retro.TeamID != teamID {
			continue
		}
		if len(statuses) > 0 {
			found := false
			for _, status := range statuses {
				if retro.Status == status {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}
		results = append(results, retro)
	}

	// Simple pagination (in production, use cursor-based pagination)
	if pageSize <= 0 {
		pageSize = 20
	}
	hasMore := len(results) > pageSize
	if hasMore {
		results = results[:pageSize]
	}

	return results, "", hasMore, nil
}

// InMemoryItemStore provides in-memory storage for retrospective items
type InMemoryItemStore struct {
	mu    sync.RWMutex
	items map[string]*vstore.RetrospectiveItem // key: item_id
}

func NewInMemoryItemStore() *InMemoryItemStore {
	return &InMemoryItemStore{
		items: make(map[string]*vstore.RetrospectiveItem),
	}
}

func (s *InMemoryItemStore) Create(item *vstore.RetrospectiveItem) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	item.Created = time.Now()
	item.Updated = time.Now()
	s.items[item.ItemID] = item
	return nil
}

func (s *InMemoryItemStore) Get(id string) (*vstore.RetrospectiveItem, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if item, ok := s.items[id]; ok {
		return item, nil
	}
	return nil, ErrNotFound
}

func (s *InMemoryItemStore) Update(item *vstore.RetrospectiveItem) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	item.Updated = time.Now()
	s.items[item.ItemID] = item
	return nil
}

func (s *InMemoryItemStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.items, id)
	return nil
}

func (s *InMemoryItemStore) ListByRetrospective(retroID string, columnID string, sortByVotes bool) ([]*vstore.RetrospectiveItem, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var results []*vstore.RetrospectiveItem
	for _, item := range s.items {
		if item.RetrospectiveID != retroID {
			continue
		}
		if columnID != "" && item.ColumnID != columnID {
			continue
		}
		results = append(results, item)
	}

	// Sort by votes if requested (simple bubble sort for MVP)
	if sortByVotes {
		for i := 0; i < len(results)-1; i++ {
			for j := 0; j < len(results)-i-1; j++ {
				if results[j].VoteCount < results[j+1].VoteCount {
					results[j], results[j+1] = results[j+1], results[j]
				}
			}
		}
	}

	return results, nil
}

func (s *InMemoryItemStore) IncrementVoteCount(itemID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if item, ok := s.items[itemID]; ok {
		item.VoteCount++
		item.Updated = time.Now()
		return nil
	}
	return ErrNotFound
}

func (s *InMemoryItemStore) DecrementVoteCount(itemID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if item, ok := s.items[itemID]; ok {
		if item.VoteCount > 0 {
			item.VoteCount--
		}
		item.Updated = time.Now()
		return nil
	}
	return ErrNotFound
}

// InMemoryVoteStore provides in-memory storage for votes
type InMemoryVoteStore struct {
	mu    sync.RWMutex
	votes map[string]*vstore.Vote // key: vote_id
}

func NewInMemoryVoteStore() *InMemoryVoteStore {
	return &InMemoryVoteStore{
		votes: make(map[string]*vstore.Vote),
	}
}

func (s *InMemoryVoteStore) Create(vote *vstore.Vote) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	vote.Created = time.Now()
	s.votes[vote.VoteID] = vote
	return nil
}

func (s *InMemoryVoteStore) Delete(voteID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.votes, voteID)
	return nil
}

func (s *InMemoryVoteStore) GetByUserAndItem(retroID, itemID, userID string) (*vstore.Vote, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, vote := range s.votes {
		if vote.RetrospectiveID == retroID && vote.ItemID == itemID && vote.UserID == userID {
			return vote, nil
		}
	}
	return nil, ErrNotFound
}

func (s *InMemoryVoteStore) CountByUser(retroID, userID string) (int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	count := 0
	for _, vote := range s.votes {
		if vote.RetrospectiveID == retroID && vote.UserID == userID {
			count++
		}
	}
	return count, nil
}

func (s *InMemoryVoteStore) ListByUser(retroID, userID string) ([]*vstore.Vote, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var results []*vstore.Vote
	for _, vote := range s.votes {
		if vote.RetrospectiveID == retroID && vote.UserID == userID {
			results = append(results, vote)
		}
	}
	return results, nil
}

func (s *InMemoryVoteStore) ListByItem(retroID, itemID string) ([]*vstore.Vote, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var results []*vstore.Vote
	for _, vote := range s.votes {
		if vote.RetrospectiveID == retroID && vote.ItemID == itemID {
			results = append(results, vote)
		}
	}
	return results, nil
}

// InMemoryActionItemStore provides in-memory storage for action items
type InMemoryActionItemStore struct {
	mu          sync.RWMutex
	actionItems map[string]*vstore.ActionItem // key: action_item_id
}

func NewInMemoryActionItemStore() *InMemoryActionItemStore {
	return &InMemoryActionItemStore{
		actionItems: make(map[string]*vstore.ActionItem),
	}
}

func (s *InMemoryActionItemStore) Create(item *vstore.ActionItem) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	item.Created = time.Now()
	item.Updated = time.Now()
	s.actionItems[item.ActionItemID] = item
	return nil
}

func (s *InMemoryActionItemStore) Get(id string) (*vstore.ActionItem, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if item, ok := s.actionItems[id]; ok {
		return item, nil
	}
	return nil, ErrNotFound
}

func (s *InMemoryActionItemStore) Update(item *vstore.ActionItem) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	item.Updated = time.Now()
	s.actionItems[item.ActionItemID] = item
	return nil
}

func (s *InMemoryActionItemStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.actionItems, id)
	return nil
}

func (s *InMemoryActionItemStore) ListByRetrospective(retroID string) ([]*vstore.ActionItem, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var results []*vstore.ActionItem
	for _, item := range s.actionItems {
		if item.RetrospectiveID == retroID {
			results = append(results, item)
		}
	}
	return results, nil
}

func (s *InMemoryActionItemStore) ListByTeam(teamID string, includeCompleted bool) ([]*vstore.ActionItem, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var results []*vstore.ActionItem
	for _, item := range s.actionItems {
		if item.TeamID != teamID {
			continue
		}
		if !includeCompleted && (item.Status == vstore.ActionItemStatusDone || item.Status == vstore.ActionItemStatusWontDo) {
			continue
		}
		results = append(results, item)
	}
	return results, nil
}

// InMemoryParticipantStore provides in-memory storage for participants
type InMemoryParticipantStore struct {
	mu           sync.RWMutex
	participants map[string]*vstore.Participant // key: participant_id
}

func NewInMemoryParticipantStore() *InMemoryParticipantStore {
	return &InMemoryParticipantStore{
		participants: make(map[string]*vstore.Participant),
	}
}

func (s *InMemoryParticipantStore) Join(participant *vstore.Participant) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	participant.JoinedAt = time.Now()
	participant.LastActive = time.Now()
	participant.IsOnline = true
	key := participant.RetrospectiveID + ":" + participant.UserID
	s.participants[key] = participant
	return nil
}

func (s *InMemoryParticipantStore) Leave(retroID, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	key := retroID + ":" + userID
	if p, ok := s.participants[key]; ok {
		p.IsOnline = false
		p.LastActive = time.Now()
	}
	return nil
}

func (s *InMemoryParticipantStore) Heartbeat(retroID, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	key := retroID + ":" + userID
	if p, ok := s.participants[key]; ok {
		p.LastActive = time.Now()
		p.IsOnline = true
	}
	return nil
}

func (s *InMemoryParticipantStore) Get(retroID, userID string) (*vstore.Participant, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	key := retroID + ":" + userID
	if p, ok := s.participants[key]; ok {
		return p, nil
	}
	return nil, ErrNotFound
}

func (s *InMemoryParticipantStore) ListByRetrospective(retroID string) ([]*vstore.Participant, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var results []*vstore.Participant
	for _, p := range s.participants {
		if p.RetrospectiveID == retroID && p.IsOnline {
			results = append(results, p)
		}
	}
	return results, nil
}
