// Package api exposes the calculator over HTTP with consistent JSON responses.
package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"reflect"
	"strings"

	"sezzle-calculator/backend/internal/calculator"
)

// Fits the longest allowed expression (256 characters, some multi-byte) with room to spare.
const maxBodyBytes = 2 << 10

type calculateRequest struct {
	Operation calculator.Operation `json:"operation"`
	// Pointers distinguish a missing operand from an explicit 0.
	A *float64 `json:"a"`
	B *float64 `json:"b"`
}

type evaluateRequest struct {
	Expression string `json:"expression"`
}

// resultResponse is the success body for both calculation endpoints.
type resultResponse struct {
	Result float64 `json:"result"`
}

// NewRouter returns the HTTP handler for the whole API, including middleware.
func NewRouter() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/calculate", handleCalculate)
	mux.HandleFunc("/api/v1/evaluate", handleEvaluate)
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

	var req calculateRequest
	if err := decodeJSON(w, r, &req); err != nil {
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
	writeJSON(w, http.StatusOK, resultResponse{Result: result})
}

func handleEvaluate(w http.ResponseWriter, r *http.Request) {
	if !allowMethod(w, r, http.MethodPost) {
		return
	}

	var req evaluateRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, CodeInvalidRequest, err.Error())
		return
	}
	if strings.TrimSpace(req.Expression) == "" {
		writeError(w, http.StatusBadRequest, CodeInvalidRequest, `Field "expression" is required.`)
		return
	}

	result, err := calculator.Evaluate(req.Expression)
	if err != nil {
		status, code, message := mapCalculatorError(err, "")
		writeError(w, status, code, message)
		return
	}
	writeJSON(w, http.StatusOK, resultResponse{Result: result})
}

// decodeJSON strictly parses the body into dst, returning user-facing errors.
func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes))
	dec.DisallowUnknownFields()

	if err := dec.Decode(dst); err != nil {
		var typeErr *json.UnmarshalTypeError
		var maxErr *http.MaxBytesError
		switch {
		case errors.As(err, &typeErr):
			return fmt.Errorf("Field %q must be a %s.", typeErr.Field, jsonTypeName(typeErr.Type.Kind()))
		case errors.As(err, &maxErr):
			return errors.New("Request body is too large.")
		case errors.Is(err, io.EOF):
			return errors.New("Request body is required.")
		default:
			// Covers malformed JSON and unknown fields; the decoder's message is descriptive enough.
			return fmt.Errorf("Request body is not valid: %s.", strings.TrimPrefix(err.Error(), "json: "))
		}
	}
	if dec.More() {
		return errors.New("Request body must contain a single JSON object.")
	}
	return nil
}

func jsonTypeName(kind reflect.Kind) string {
	if kind == reflect.String {
		return "string"
	}
	return "number"
}

func mapCalculatorError(err error, op calculator.Operation) (status int, code, message string) {
	switch {
	case errors.Is(err, calculator.ErrUnsupportedOperation):
		return http.StatusBadRequest, CodeUnsupportedOperation, fmt.Sprintf(
			"Unsupported operation %q. Supported operations: add, subtract, multiply, divide, power, sqrt, percentage.", op)
	case errors.Is(err, calculator.ErrInvalidExpression):
		return http.StatusBadRequest, CodeInvalidExpression, fmt.Sprintf("Invalid expression: %s.", err)
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
