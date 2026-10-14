// Package api exposes the calculator over HTTP with consistent JSON responses.
package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"sezzle-calculator/backend/internal/calculator"
)

const maxBodyBytes = 1 << 10 // a valid request is well under 100 bytes

type calculateRequest struct {
	Operation calculator.Operation `json:"operation"`
	// Pointers distinguish a missing operand from an explicit 0.
	A *float64 `json:"a"`
	B *float64 `json:"b"`
}

type calculateResponse struct {
	Result float64 `json:"result"`
}

// NewRouter returns the HTTP handler for the whole API, including middleware.
func NewRouter() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/calculate", handleCalculate)
	mux.HandleFunc("/api/health", handleHealth)
	mux.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) {
		writeError(w, http.StatusNotFound, CodeNotFound, "Resource not found.")
	})
	return logRequests(recoverPanics(mux))
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodGet) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func handleCalculate(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodPost) {
		return
	}

	req, err := decodeCalculateRequest(w, r)
	if err != nil {
		writeError(w, http.StatusBadRequest, CodeInvalidRequest, err.Error())
		return
	}
	if req.Operation == "" {
		writeError(w, http.StatusBadRequest, CodeInvalidRequest, `Field "operation" is required.`)
		return
	}
	if req.A == nil {
		writeError(w, http.StatusBadRequest, CodeMissingOperand, `Field "a" is required.`)
		return
	}

	result, err := calculator.Calculate(req.Operation, *req.A, req.B)
	if err != nil {
		status, code, message := mapCalculatorError(err, req.Operation)
		writeError(w, status, code, message)
		return
	}
	writeJSON(w, http.StatusOK, calculateResponse{Result: result})
}

// decodeCalculateRequest strictly parses the body, returning user-facing errors.
func decodeCalculateRequest(w http.ResponseWriter, r *http.Request) (calculateRequest, error) {
	var req calculateRequest
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes))
	dec.DisallowUnknownFields()

	if err := dec.Decode(&req); err != nil {
		var typeErr *json.UnmarshalTypeError
		var maxErr *http.MaxBytesError
		switch {
		case errors.As(err, &typeErr):
			return req, fmt.Errorf("Field %q must be a %s.", typeErr.Field, expectedType(typeErr.Field))
		case errors.As(err, &maxErr):
			return req, errors.New("Request body is too large.")
		case errors.Is(err, io.EOF):
			return req, errors.New("Request body is required.")
		default:
			// Covers malformed JSON and unknown fields; the decoder's message is descriptive enough.
			return req, fmt.Errorf("Request body is not valid: %s.", strings.TrimPrefix(err.Error(), "json: "))
		}
	}
	if dec.More() {
		return req, errors.New("Request body must contain a single JSON object.")
	}
	return req, nil
}

func expectedType(field string) string {
	if field == "operation" {
		return "string"
	}
	return "number"
}

func mapCalculatorError(err error, op calculator.Operation) (status int, code, message string) {
	switch {
	case errors.Is(err, calculator.ErrUnsupportedOperation):
		return http.StatusBadRequest, CodeUnsupportedOperation, fmt.Sprintf(
			"Unsupported operation %q. Supported operations: add, subtract, multiply, divide, power, sqrt, percentage.", op)
	case errors.Is(err, calculator.ErrMissingOperand):
		return http.StatusBadRequest, CodeMissingOperand, fmt.Sprintf(`Field "b" is required for operation %q.`, op)
	case errors.Is(err, calculator.ErrDivisionByZero):
		return http.StatusUnprocessableEntity, CodeDivisionByZero, "Division by zero is not allowed."
	case errors.Is(err, calculator.ErrNegativeSquareRoot):
		return http.StatusUnprocessableEntity, CodeNegativeSquareRoot, "Cannot take the square root of a negative number."
	case errors.Is(err, calculator.ErrResultOutOfRange):
		return http.StatusUnprocessableEntity, CodeResultOutOfRange, "The result is undefined or too large to represent."
	default:
		return http.StatusInternalServerError, CodeInternalError, "An unexpected error occurred."
	}
}

func allowMethod(w http.ResponseWriter, r *http.Request, method string) bool {
	if r.Method == method {
		return true
	}
	w.Header().Set("Allow", method)
	writeError(w, http.StatusMethodNotAllowed, CodeMethodNotAllowed, fmt.Sprintf("Method %s is not allowed; use %s.", r.Method, method))
	return false
}
