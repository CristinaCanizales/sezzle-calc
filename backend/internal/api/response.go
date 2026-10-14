package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// Error codes are part of the API contract; clients branch on them, not on messages.
const (
	CodeInvalidRequest       = "INVALID_REQUEST"
	CodeMissingOperand       = "MISSING_OPERAND"
	CodeUnsupportedOperation = "UNSUPPORTED_OPERATION"
	CodeDivisionByZero       = "DIVISION_BY_ZERO"
	CodeNegativeSquareRoot   = "NEGATIVE_SQUARE_ROOT"
	CodeResultOutOfRange     = "RESULT_OUT_OF_RANGE"
	CodeMethodNotAllowed     = "METHOD_NOT_ALLOWED"
	CodeNotFound             = "NOT_FOUND"
	CodeInternalError        = "INTERNAL_ERROR"
)

type errorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type errorResponse struct {
	Error errorDetail `json:"error"`
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		slog.Error("failed to write response", "error", err)
	}
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, errorResponse{Error: errorDetail{Code: code, Message: message}})
}
