package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/reflection"

	"github.com/vendasta/retrospective/internal/api"
	pb "github.com/vendasta/generated-protos-go/retrospective/v1"
)

const (
	defaultPort = "8080"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}

	lis, err := net.Listen("tcp", fmt.Sprintf(":%s", port))
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	// Create gRPC server with interceptors
	grpcServer := grpc.NewServer(
		// Add your interceptors here (auth, logging, etc.)
	)

	// Initialize stores (in production, these would be backed by vstore)
	retroStore := api.NewInMemoryRetrospectiveStore()
	itemStore := api.NewInMemoryItemStore()
	voteStore := api.NewInMemoryVoteStore()
	actionItemStore := api.NewInMemoryActionItemStore()
	participantStore := api.NewInMemoryParticipantStore()

	// Initialize and register services
	retrospectiveService := api.NewRetrospectiveService(retroStore, itemStore, actionItemStore)
	itemService := api.NewRetrospectiveItemService(itemStore, retroStore)
	votingService := api.NewVotingService(voteStore, itemStore, retroStore)
	actionItemService := api.NewActionItemService(actionItemStore, retroStore)
	realtimeService := api.NewRealtimeService(participantStore, retroStore)
	templateService := api.NewTemplateService()

	// Register services with gRPC server
	pb.RegisterRetrospectiveServiceServer(grpcServer, retrospectiveService)
	pb.RegisterRetrospectiveItemServiceServer(grpcServer, itemService)
	pb.RegisterVotingServiceServer(grpcServer, votingService)
	pb.RegisterActionItemServiceServer(grpcServer, actionItemService)
	pb.RegisterRealtimeServiceServer(grpcServer, realtimeService)
	pb.RegisterTemplateServiceServer(grpcServer, templateService)

	// Register health check service
	healthServer := health.NewServer()
	grpc_health_v1.RegisterHealthServer(grpcServer, healthServer)
	healthServer.SetServingStatus("", grpc_health_v1.HealthCheckResponse_SERVING)

	// Enable reflection for development
	reflection.Register(grpcServer)

	// Handle graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigCh
		log.Println("Received shutdown signal, gracefully stopping...")
		healthServer.SetServingStatus("", grpc_health_v1.HealthCheckResponse_NOT_SERVING)
		grpcServer.GracefulStop()
		cancel()
	}()

	log.Printf("Retrospective service starting on port %s", port)
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}

	<-ctx.Done()
	log.Println("Server stopped")
}
