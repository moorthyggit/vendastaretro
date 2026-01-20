package api

import (
	"context"

	pb "github.com/vendasta/generated-protos-go/retrospective/v1"
)

// TemplateService implements the TemplateService gRPC service
type TemplateService struct {
	pb.UnimplementedTemplateServiceServer
}

// NewTemplateService creates a new TemplateService
func NewTemplateService() *TemplateService {
	return &TemplateService{}
}

// GetDefaultTemplate returns the default template configuration for a template type
func (s *TemplateService) GetDefaultTemplate(ctx context.Context, req *pb.GetDefaultTemplateRequest) (*pb.GetDefaultTemplateResponse, error) {
	templateType := req.Type
	if templateType == pb.RetrospectiveTemplateType_RETROSPECTIVE_TEMPLATE_TYPE_UNSPECIFIED {
		templateType = pb.RetrospectiveTemplateType_RETROSPECTIVE_TEMPLATE_TYPE_WENT_WELL_TO_IMPROVE
	}

	columns := getDefaultPbTemplateColumns(templateType)

	return &pb.GetDefaultTemplateResponse{
		Template: &pb.RetrospectiveTemplate{
			Type:    templateType,
			Columns: columns,
		},
	}, nil
}

func getDefaultPbTemplateColumns(templateType pb.RetrospectiveTemplateType) []*pb.TemplateColumn {
	switch templateType {
	case pb.RetrospectiveTemplateType_RETROSPECTIVE_TEMPLATE_TYPE_WENT_WELL_TO_IMPROVE:
		return []*pb.TemplateColumn{
			{
				ColumnId:    "went_well",
				Name:        "What Went Well",
				Description: "Things that worked well this sprint",
				Icon:        "👍",
				SortOrder:   1,
				Color:       "#22c55e",
			},
			{
				ColumnId:    "to_improve",
				Name:        "What To Improve",
				Description: "Things that could be better",
				Icon:        "🔧",
				SortOrder:   2,
				Color:       "#f59e0b",
			},
			{
				ColumnId:    "action_items",
				Name:        "Action Items",
				Description: "Specific actions to take",
				Icon:        "✅",
				SortOrder:   3,
				Color:       "#3b82f6",
			},
		}

	case pb.RetrospectiveTemplateType_RETROSPECTIVE_TEMPLATE_TYPE_START_STOP_CONTINUE:
		return []*pb.TemplateColumn{
			{
				ColumnId:    "start",
				Name:        "Start",
				Description: "Things we should start doing",
				Icon:        "🚀",
				SortOrder:   1,
				Color:       "#22c55e",
			},
			{
				ColumnId:    "stop",
				Name:        "Stop",
				Description: "Things we should stop doing",
				Icon:        "🛑",
				SortOrder:   2,
				Color:       "#ef4444",
			},
			{
				ColumnId:    "continue",
				Name:        "Continue",
				Description: "Things we should keep doing",
				Icon:        "➡️",
				SortOrder:   3,
				Color:       "#3b82f6",
			},
		}

	case pb.RetrospectiveTemplateType_RETROSPECTIVE_TEMPLATE_TYPE_FOUR_LS:
		return []*pb.TemplateColumn{
			{
				ColumnId:    "liked",
				Name:        "Liked",
				Description: "What we liked",
				Icon:        "❤️",
				SortOrder:   1,
				Color:       "#ec4899",
			},
			{
				ColumnId:    "learned",
				Name:        "Learned",
				Description: "What we learned",
				Icon:        "📚",
				SortOrder:   2,
				Color:       "#8b5cf6",
			},
			{
				ColumnId:    "lacked",
				Name:        "Lacked",
				Description: "What was lacking",
				Icon:        "🤔",
				SortOrder:   3,
				Color:       "#f59e0b",
			},
			{
				ColumnId:    "longed_for",
				Name:        "Longed For",
				Description: "What we wish we had",
				Icon:        "✨",
				SortOrder:   4,
				Color:       "#06b6d4",
			},
		}

	case pb.RetrospectiveTemplateType_RETROSPECTIVE_TEMPLATE_TYPE_MAD_SAD_GLAD:
		return []*pb.TemplateColumn{
			{
				ColumnId:    "mad",
				Name:        "Mad",
				Description: "Things that frustrated us",
				Icon:        "😠",
				SortOrder:   1,
				Color:       "#ef4444",
			},
			{
				ColumnId:    "sad",
				Name:        "Sad",
				Description: "Things that disappointed us",
				Icon:        "😢",
				SortOrder:   2,
				Color:       "#6366f1",
			},
			{
				ColumnId:    "glad",
				Name:        "Glad",
				Description: "Things that made us happy",
				Icon:        "😊",
				SortOrder:   3,
				Color:       "#22c55e",
			},
		}

	default:
		return getDefaultPbTemplateColumns(pb.RetrospectiveTemplateType_RETROSPECTIVE_TEMPLATE_TYPE_WENT_WELL_TO_IMPROVE)
	}
}
