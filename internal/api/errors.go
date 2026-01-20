package api

import (
	"errors"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

var (
	// ErrNotFound is returned when a resource is not found
	ErrNotFound = errors.New("not found")

	// ErrAlreadyExists is returned when trying to create a duplicate resource
	ErrAlreadyExists = errors.New("already exists")

	// ErrInvalidArgument is returned for invalid input
	ErrInvalidArgument = errors.New("invalid argument")

	// ErrPermissionDenied is returned when user lacks permission
	ErrPermissionDenied = errors.New("permission denied")

	// ErrVoteLimitExceeded is returned when user has used all votes
	ErrVoteLimitExceeded = errors.New("vote limit exceeded")

	// ErrInvalidStatus is returned for invalid status transitions
	ErrInvalidStatus = errors.New("invalid status transition")
)

// ToGRPCError converts internal errors to gRPC status errors
func ToGRPCError(err error) error {
	if err == nil {
		return nil
	}

	switch {
	case errors.Is(err, ErrNotFound):
		return status.Error(codes.NotFound, err.Error())
	case errors.Is(err, ErrAlreadyExists):
		return status.Error(codes.AlreadyExists, err.Error())
	case errors.Is(err, ErrInvalidArgument):
		return status.Error(codes.InvalidArgument, err.Error())
	case errors.Is(err, ErrPermissionDenied):
		return status.Error(codes.PermissionDenied, err.Error())
	case errors.Is(err, ErrVoteLimitExceeded):
		return status.Error(codes.FailedPrecondition, err.Error())
	case errors.Is(err, ErrInvalidStatus):
		return status.Error(codes.FailedPrecondition, err.Error())
	default:
		return status.Error(codes.Internal, err.Error())
	}
}
