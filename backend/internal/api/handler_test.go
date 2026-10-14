package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func doRequest(t *testing.T, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	NewRouter().ServeHTTP(rec, req)
	return rec
}

func TestCalculateSuccess(t *testing.T) {
	tests := []struct {
		name string
		body string
		want float64
	}{
		{"add", `{"operation":"add","a":2,"b":3}`, 5},
		{"subtract", `{"operation":"subtract","a":2,"b":3}`, -1},
		{"multiply", `{"operation":"multiply","a":2.5,"b":4}`, 10},
		{"divide", `{"operation":"divide","a":10,"b":4}`, 2.5},
		{"power", `{"operation":"power","a":2,"b":8}`, 256},
		{"sqrt without b", `{"operation":"sqrt","a":81}`, 9},
		{"percentage without b", `{"operation":"percentage","a":20}`, 0.2},
		{"explicit zero operand is not treated as missing", `{"operation":"add","a":0,"b":0}`, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := doRequest(t, http.MethodPost, "/api/v1/calculate", tt.body)

			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200; body: %s", rec.Code, rec.Body)
			}
			if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
				t.Errorf("Content-Type = %q, want application/json", ct)
			}
			var resp resultResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
				t.Fatalf("invalid JSON response: %v", err)
			}
			if resp.Result != tt.want {
				t.Errorf("result = %v, want %v", resp.Result, tt.want)
			}
		})
	}
}

func TestCalculateErrors(t *testing.T) {
	tests := []struct {
		name       string
		method     string
		body       string
		wantStatus int
		wantCode   string
	}{
		{"division by zero", http.MethodPost, `{"operation":"divide","a":1,"b":0}`, 422, CodeDivisionByZero},
		{"negative square root", http.MethodPost, `{"operation":"sqrt","a":-1}`, 422, CodeNegativeSquareRoot},
		{"overflow", http.MethodPost, `{"operation":"power","a":10,"b":400}`, 422, CodeResultOutOfRange},
		{"malformed JSON", http.MethodPost, `{"operation":`, 400, CodeInvalidRequest},
		{"empty body", http.MethodPost, ``, 400, CodeInvalidRequest},
		{"unknown field", http.MethodPost, `{"operation":"add","a":1,"b":2,"c":3}`, 400, CodeInvalidRequest},
		{"operand is a string", http.MethodPost, `{"operation":"add","a":"1","b":2}`, 400, CodeInvalidRequest},
		{"multiple JSON objects", http.MethodPost, `{"operation":"add","a":1,"b":2}{}`, 400, CodeInvalidRequest},
		{"body too large", http.MethodPost, `{"operation":"add","a":1,"b":2,"x":"` + strings.Repeat("x", 5000) + `"}`, 400, CodeInvalidRequest},
		{"missing operation", http.MethodPost, `{"a":1,"b":2}`, 400, CodeInvalidRequest},
		{"missing a", http.MethodPost, `{"operation":"add","b":2}`, 400, CodeMissingOperand},
		{"null a", http.MethodPost, `{"operation":"add","a":null,"b":2}`, 400, CodeMissingOperand},
		{"missing b for binary operation", http.MethodPost, `{"operation":"divide","a":1}`, 400, CodeMissingOperand},
		{"unsupported operation", http.MethodPost, `{"operation":"modulo","a":1,"b":2}`, 400, CodeUnsupportedOperation},
		{"wrong method", http.MethodGet, ``, 405, CodeMethodNotAllowed},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := doRequest(t, tt.method, "/api/v1/calculate", tt.body)
			assertError(t, rec, tt.wantStatus, tt.wantCode)
		})
	}
}

func TestEvaluateSuccess(t *testing.T) {
	tests := []struct {
		name string
		body string
		want float64
	}{
		{"precedence", `{"expression":"2 + 3 * 4"}`, 14},
		{"parentheses", `{"expression":"(2 + 3) * 4"}`, 20},
		{"unicode operators", `{"expression":"6 × 7 ÷ 2 − 1"}`, 20},
		{"percent and sqrt", `{"expression":"150 * 20% + sqrt(9)"}`, 33},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := doRequest(t, http.MethodPost, "/api/v1/evaluate", tt.body)

			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200; body: %s", rec.Code, rec.Body)
			}
			var resp resultResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
				t.Fatalf("invalid JSON response: %v", err)
			}
			if resp.Result != tt.want {
				t.Errorf("result = %v, want %v", resp.Result, tt.want)
			}
		})
	}
}

func TestEvaluateErrors(t *testing.T) {
	tests := []struct {
		name       string
		method     string
		body       string
		wantStatus int
		wantCode   string
	}{
		{"syntax error", http.MethodPost, `{"expression":"2 + )"}`, 400, CodeInvalidExpression},
		{"unbalanced parentheses", http.MethodPost, `{"expression":"(2 + 3"}`, 400, CodeInvalidExpression},
		{"too long", http.MethodPost, `{"expression":"` + strings.Repeat("1+", 200) + `1"}`, 400, CodeInvalidExpression},
		{"missing expression", http.MethodPost, `{}`, 400, CodeInvalidRequest},
		{"blank expression", http.MethodPost, `{"expression":"  "}`, 400, CodeInvalidRequest},
		{"expression is a number", http.MethodPost, `{"expression":5}`, 400, CodeInvalidRequest},
		{"unknown field", http.MethodPost, `{"expression":"1","a":1}`, 400, CodeInvalidRequest},
		{"division by zero", http.MethodPost, `{"expression":"1 / (2 - 2)"}`, 422, CodeDivisionByZero},
		{"negative square root", http.MethodPost, `{"expression":"sqrt(0 - 4)"}`, 422, CodeNegativeSquareRoot},
		{"overflow", http.MethodPost, `{"expression":"10 ^ 400"}`, 422, CodeResultOutOfRange},
		{"wrong method", http.MethodGet, ``, 405, CodeMethodNotAllowed},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := doRequest(t, tt.method, "/api/v1/evaluate", tt.body)
			assertError(t, rec, tt.wantStatus, tt.wantCode)
		})
	}
}

func TestEvaluateSyntaxErrorMessageIncludesPosition(t *testing.T) {
	rec := doRequest(t, http.MethodPost, "/api/v1/evaluate", `{"expression":"2 + )"}`)
	var resp errorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if want := `Invalid expression: unexpected ")" at position 5.`; resp.Error.Message != want {
		t.Errorf("message = %q, want %q", resp.Error.Message, want)
	}
}

func TestMethodNotAllowedSetsAllowHeader(t *testing.T) {
	rec := doRequest(t, http.MethodGet, "/api/v1/calculate", "")
	if got := rec.Header().Get("Allow"); got != http.MethodPost {
		t.Errorf("Allow = %q, want POST", got)
	}
}

func TestUnknownRouteReturnsJSONNotFound(t *testing.T) {
	rec := doRequest(t, http.MethodGet, "/api/v1/nope", "")
	assertError(t, rec, http.StatusNotFound, CodeNotFound)
}

func TestHealth(t *testing.T) {
	rec := doRequest(t, http.MethodGet, "/api/health", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if body := strings.TrimSpace(rec.Body.String()); body != `{"status":"ok"}` {
		t.Errorf("body = %s", body)
	}
}

func TestRecoverPanicsReturnsJSON500(t *testing.T) {
	h := recoverPanics(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { panic("boom") }))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	assertError(t, rec, http.StatusInternalServerError, CodeInternalError)
}

// assertError checks the status and that the body follows the shared error shape.
func assertError(t *testing.T, rec *httptest.ResponseRecorder, wantStatus int, wantCode string) {
	t.Helper()
	if rec.Code != wantStatus {
		t.Fatalf("status = %d, want %d; body: %s", rec.Code, wantStatus, rec.Body)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", ct)
	}
	var resp errorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("invalid JSON error response: %v", err)
	}
	if resp.Error.Code != wantCode {
		t.Errorf("code = %q, want %q", resp.Error.Code, wantCode)
	}
	if resp.Error.Message == "" {
		t.Error("message is empty")
	}
}
