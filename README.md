# Sprint Retrospective Service

A gRPC microservice for running sprint retrospectives with real-time collaboration, voting, and action item tracking.

## Overview

This service enables distributed Scrum teams to run efficient retrospectives with:

- 🔄 **Multiple Templates**: Went Well/To Improve, Start/Stop/Continue, 4Ls, Mad/Sad/Glad
- 🗳️ **Voting System**: Configurable vote limits, anonymous voting support
- 📋 **Action Items**: Track follow-up tasks across sprints
- 👥 **Real-time Collaboration**: Live presence and updates via gRPC streaming
- 📤 **Export**: PDF, CSV, Markdown, JSON formats

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Galaxy Frontend                          │
│  (React + TypeScript + Tailwind + Framer Motion)            │
└─────────────────────┬───────────────────────────────────────┘
                      │ gRPC-Web / HTTP
┌─────────────────────▼───────────────────────────────────────┐
│                   gRPC Gateway                               │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                 Go Backend Services                          │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ Retrospective   │  │ Item Service    │                   │
│  │ Service         │  │                 │                   │
│  └─────────────────┘  └─────────────────┘                   │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ Voting Service  │  │ ActionItem      │                   │
│  │                 │  │ Service         │                   │
│  └─────────────────┘  └─────────────────┘                   │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ Realtime        │  │ Template        │                   │
│  │ Service         │  │ Service         │                   │
│  └─────────────────┘  └─────────────────┘                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                    vstore (Storage)                          │
│  Retrospective | Item | Vote | ActionItem | Participant     │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
retrospective-service/
├── server/
│   └── main.go              # Server entry point
├── internal/
│   ├── api/                 # Service implementations
│   │   ├── retrospective_service.go
│   │   ├── item_service.go
│   │   ├── voting_service.go
│   │   ├── action_item_service.go
│   │   ├── realtime_service.go
│   │   ├── template_service.go
│   │   ├── stores.go        # In-memory stores (dev)
│   │   └── errors.go        # Error handling
│   └── vstore/              # vstore schemas
│       ├── models.go
│       └── schemas.go
├── galaxy/                  # React frontend
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── hooks/           # Custom hooks & store
│   │   ├── services/        # API services
│   │   └── types/           # TypeScript types
│   └── package.json
├── microservice.yaml        # mscli configuration
├── go.mod
└── README.md
```

## Proto Definitions

Located in `vendastaapis/retrospective/v1/`:

- `api.proto` - Service definitions and request/response messages
- `retrospective.proto` - Retrospective entity
- `item.proto` - Board items (cards)
- `vote.proto` - Voting system
- `action_item.proto` - Action item tracking
- `template.proto` - Retro templates
- `participant.proto` - Presence/collaboration

## Services

### RetrospectiveService
- `Create` - Create a new retrospective
- `Get` - Get retrospective by ID
- `GetMulti` - Get multiple retrospectives
- `List` - List with filters and pagination
- `Update` - Update retrospective
- `Delete` - Delete retrospective
- `StartVoting` - Transition to voting phase
- `StartDiscussion` - Transition to discussion phase
- `Complete` - Mark as complete
- `Export` - Export to PDF/CSV/Markdown/JSON

### RetrospectiveItemService
- `Create` - Add item to board
- `Update` - Edit item content
- `Delete` - Remove item
- `List` - List items in retrospective
- `MoveToColumn` - Move item between columns

### VotingService
- `CastVote` - Vote for an item
- `RemoveVote` - Remove vote
- `GetVoteSummary` - Get vote counts and rankings
- `GetUserVotes` - Get user's vote status

### ActionItemService
- `Create` - Create action item
- `Update` - Update action item
- `UpdateStatus` - Quick status update
- `Delete` - Delete action item
- `List` - List with filters
- `ListByTeam` - List all team action items

### RealtimeService
- `Subscribe` - Stream real-time events
- `JoinRetrospective` - Join session
- `LeaveRetrospective` - Leave session
- `GetParticipants` - Get current participants
- `Heartbeat` - Keep presence alive

### TemplateService
- `GetDefaultTemplate` - Get template configuration

## Development

### Prerequisites
- Go 1.21+
- Node.js 18+
- mscli (Vendasta CLI)

### Running Locally

1. Start the backend:
```bash
cd retrospective-service
go run server/main.go
```

2. Start the frontend:
```bash
cd retrospective-service/galaxy
npm install
npm run dev
```

3. Access at http://localhost:3000

### Generating Protos

```bash
# From vendastaapis directory
mscli app sdk -l go

# Or use buf
buf generate
```

### Running Tests

```bash
go test ./...
```

## Access Scopes

- `retrospective:read` - Read access to retrospectives, items, votes
- `retrospective:write` - Write access to create/update/delete

## Templates

| Template | Columns |
|----------|---------|
| Went Well / To Improve | 👍 Went Well, 🔧 To Improve, ✅ Action Items |
| Start / Stop / Continue | 🚀 Start, 🛑 Stop, ➡️ Continue |
| 4Ls | ❤️ Liked, 📚 Learned, 🤔 Lacked, ✨ Longed For |
| Mad / Sad / Glad | 😠 Mad, 😢 Sad, 😊 Glad |

## Deployment

### Using mscli

```bash
# Provision infrastructure
mscli app provision --env=demo

# Deploy
mscli app deploy --env=demo --tag=<version>
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 8080 |
| `VSTORE_ENDPOINT` | vstore endpoint | localhost:9000 |
| `PUBSUB_PROJECT` | Pub/Sub project | - |

## Contributing

1. Create feature branch
2. Make changes
3. Run tests
4. Submit PR

## License

Copyright © Vendasta Technologies Inc.
