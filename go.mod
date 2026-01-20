module github.com/vendasta/retrospective

go 1.21

require (
	github.com/vendasta/generated-protos-go v0.0.0
	github.com/vendasta/gosdks v0.0.0
	google.golang.org/grpc v1.60.0
	google.golang.org/protobuf v1.32.0
)

replace github.com/vendasta/generated-protos-go => ../generated-protos-go

// Note: In production, you would use actual version tags
// require github.com/vendasta/generated-protos-go v1.0.0
