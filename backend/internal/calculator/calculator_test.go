package calculator

import (
	"errors"
	"math"
	"testing"
)

func ptr(f float64) *float64 { return &f }

func TestCalculate(t *testing.T) {
	tests := []struct {
		name    string
		op      Operation
		a       float64
		b       *float64
		want    float64
		wantErr error
	}{
		// Basic operations
		{name: "add", op: Add, a: 2, b: ptr(3), want: 5},
		{name: "add negatives", op: Add, a: -2.5, b: ptr(-1.5), want: -4},
		{name: "subtract", op: Subtract, a: 10, b: ptr(4), want: 6},
		{name: "subtract to negative", op: Subtract, a: 4, b: ptr(10), want: -6},
		{name: "multiply", op: Multiply, a: 6, b: ptr(7), want: 42},
		{name: "multiply by zero gives positive zero", op: Multiply, a: -5, b: ptr(0), want: 0},
		{name: "divide", op: Divide, a: 10, b: ptr(4), want: 2.5},
		{name: "divide negative", op: Divide, a: -9, b: ptr(3), want: -3},
		{name: "zero divided by number", op: Divide, a: 0, b: ptr(5), want: 0},

		// Optional operations
		{name: "power", op: Power, a: 2, b: ptr(10), want: 1024},
		{name: "power negative exponent", op: Power, a: 2, b: ptr(-2), want: 0.25},
		{name: "power fractional exponent", op: Power, a: 9, b: ptr(0.5), want: 3},
		{name: "power zero exponent", op: Power, a: 0, b: ptr(0), want: 1},
		{name: "sqrt", op: Sqrt, a: 16, want: 4},
		{name: "sqrt zero", op: Sqrt, a: 0, want: 0},
		{name: "sqrt ignores second operand", op: Sqrt, a: 9, b: ptr(100), want: 3},
		{name: "percentage", op: Percentage, a: 20, want: 0.2},
		{name: "percentage negative", op: Percentage, a: -50, want: -0.5},

		// Edge cases and errors
		{name: "divide by zero", op: Divide, a: 1, b: ptr(0), wantErr: ErrDivisionByZero},
		{name: "zero divided by zero", op: Divide, a: 0, b: ptr(0), wantErr: ErrDivisionByZero},
		{name: "sqrt negative", op: Sqrt, a: -4, wantErr: ErrNegativeSquareRoot},
		{name: "power overflow", op: Power, a: 10, b: ptr(400), wantErr: ErrResultOutOfRange},
		{name: "zero to negative power", op: Power, a: 0, b: ptr(-1), wantErr: ErrResultOutOfRange},
		{name: "negative base fractional exponent", op: Power, a: -8, b: ptr(0.5), wantErr: ErrResultOutOfRange},
		{name: "multiply overflow", op: Multiply, a: math.MaxFloat64, b: ptr(2), wantErr: ErrResultOutOfRange},
		{name: "binary op missing operand", op: Add, a: 1, wantErr: ErrMissingOperand},
		{name: "unsupported operation", op: "modulo", a: 1, b: ptr(2), wantErr: ErrUnsupportedOperation},
		{name: "empty operation", op: "", a: 1, b: ptr(2), wantErr: ErrUnsupportedOperation},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Calculate(tt.op, tt.a, tt.b)

			if tt.wantErr != nil {
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("Calculate() error = %v, want %v", err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("Calculate() unexpected error: %v", err)
			}
			if got != tt.want || math.Signbit(got) != math.Signbit(tt.want) {
				t.Errorf("Calculate() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestFloatingPointIsReturnedUnrounded(t *testing.T) {
	// Rounding for display is the client's job; the API returns the exact float64.
	got, err := Calculate(Add, 0.1, ptr(0.2))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	const want = 0.30000000000000004 // 0.1 + 0.2 in float64 arithmetic
	if got != want {
		t.Errorf("Calculate() = %v, want %v", got, want)
	}
}

func TestIsUnary(t *testing.T) {
	for op, want := range map[Operation]bool{
		Add: false, Subtract: false, Multiply: false, Divide: false, Power: false,
		Sqrt: true, Percentage: true, "unknown": false,
	} {
		if got := IsUnary(op); got != want {
			t.Errorf("IsUnary(%q) = %v, want %v", op, got, want)
		}
	}
}
