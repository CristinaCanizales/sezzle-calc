package calculator

import (
	"errors"
	"math"
	"strings"
	"testing"
)

func TestEvaluate(t *testing.T) {
	tests := []struct {
		expr string
		want float64
	}{
		// Precedence and associativity
		{"2 + 3 * 4", 14},
		{"(2 + 3) * 4", 20},
		{"10 - 4 - 3", 3},
		{"8 / 4 / 2", 1},
		{"2 * 3 + 4 * 5", 26},
		{"2 ^ 3 ^ 2", 512}, // right-associative: 2^(3^2)
		{"2 * 3 ^ 2", 18},
		{"((1 + 2) * (3 + 4))", 21},

		// Unary minus
		{"-5 + 3", -2},
		{"2 * -3", -6},
		{"--3", 3},
		{"-2 ^ 2", -4}, // standard notation: -(2^2)
		{"(-2) ^ 2", 4},
		{"2 ^ -1", 0.5},
		{"+4", 4},

		// Percentage: x% = x/100, except after + or - where it is x percent of the left side
		{"150 * 20%", 30},
		{"200 / 50%", 400},
		{"20%", 0.2},
		{"50 + 10%", 55},
		{"200 - 10%", 180},
		{"50 + -10%", 45},
		{"50 + 10% + 10%", 60.5},
		{"2 * 50 + 10%", 110},
		{"(50 + 10%) * 2", 110},
		{"50 + 10% * 2", 50.2}, // the right operand is 10% * 2, not a bare percentage
		{"200%%", 0.02},

		// Square root
		{"√9 + 1", 4},
		{"√(9 + 7)", 4},
		{"sqrt 16", 4},
		{"SQRT(4) * 2", 4},
		{"√√16", 2},
		{"2 * √9", 6},

		// Number formats, Unicode operators and whitespace
		{"1.5 + .5", 2},
		{"1.5e3 + 1", 1501},
		{"1e-3 * 1000", 1},
		{"6 × 7 ÷ 2 − 1", 20},
		{"  2+3*4  ", 14},
		{"42", 42},
		{"-0 * 5", 0},
	}

	for _, tt := range tests {
		t.Run(tt.expr, func(t *testing.T) {
			got, err := Evaluate(tt.expr)
			if err != nil {
				t.Fatalf("Evaluate(%q) unexpected error: %v", tt.expr, err)
			}
			if math.Abs(got-tt.want) > 1e-12 || math.Signbit(got) != math.Signbit(tt.want) {
				t.Errorf("Evaluate(%q) = %v, want %v", tt.expr, got, tt.want)
			}
		})
	}
}

func TestEvaluateErrors(t *testing.T) {
	tests := []struct {
		expr    string
		wantErr error
	}{
		// Syntax errors
		{"", ErrInvalidExpression},
		{"   ", ErrInvalidExpression},
		{"2 +", ErrInvalidExpression},
		{"* 2", ErrInvalidExpression},
		{"(2 + 3", ErrInvalidExpression},
		{"2 + 3)", ErrInvalidExpression},
		{"()", ErrInvalidExpression},
		{"2 3", ErrInvalidExpression},
		{"2 (3)", ErrInvalidExpression}, // no implicit multiplication
		{"1.2.3", ErrInvalidExpression},
		{".", ErrInvalidExpression},
		{"abc", ErrInvalidExpression},
		{"2e", ErrInvalidExpression},
		{"2 & 3", ErrInvalidExpression},
		{"√-4", ErrInvalidExpression}, // √ takes a number or parentheses
		{"%", ErrInvalidExpression},
		{strings.Repeat("1+", MaxExpressionLength), ErrInvalidExpression},

		// Domain errors come from Calculate
		{"1 / 0", ErrDivisionByZero},
		{"1 / (2 - 2)", ErrDivisionByZero},
		{"√(-4)", ErrNegativeSquareRoot},
		{"10 ^ 400", ErrResultOutOfRange},
		{"0 ^ -1", ErrResultOutOfRange},
		{"1e999", ErrResultOutOfRange},

		// Syntax is checked before anything is evaluated
		{"1 / 0 +", ErrInvalidExpression},
	}

	for _, tt := range tests {
		t.Run(tt.expr, func(t *testing.T) {
			_, err := Evaluate(tt.expr)
			if !errors.Is(err, tt.wantErr) {
				t.Errorf("Evaluate(%q) error = %v, want %v", tt.expr, err, tt.wantErr)
			}
		})
	}
}

func TestSyntaxErrorPosition(t *testing.T) {
	tests := []struct {
		expr    string
		wantPos int
		wantMsg string
	}{
		{"2 + )", 5, `unexpected ")"`},
		{"2 +", 4, "unexpected end of expression"},
		{"(1 + 2", 1, `missing ")"`},
		{"1 + abc", 5, `unknown name "abc"`},
	}

	for _, tt := range tests {
		t.Run(tt.expr, func(t *testing.T) {
			_, err := Evaluate(tt.expr)
			var syntaxErr *SyntaxError
			if !errors.As(err, &syntaxErr) {
				t.Fatalf("Evaluate(%q) error = %v, want *SyntaxError", tt.expr, err)
			}
			if syntaxErr.Pos != tt.wantPos || !strings.Contains(syntaxErr.Msg, tt.wantMsg) {
				t.Errorf("got %q at %d, want %q at %d", syntaxErr.Msg, syntaxErr.Pos, tt.wantMsg, tt.wantPos)
			}
		})
	}
}
