// Package calculator implements the arithmetic operations supported by the API.
// It has no knowledge of HTTP; callers map its sentinel errors to responses.
package calculator

import (
	"errors"
	"math"
)

// Operation identifies a supported calculation.
type Operation string

const (
	Add        Operation = "add"
	Subtract   Operation = "subtract"
	Multiply   Operation = "multiply"
	Divide     Operation = "divide"
	Power      Operation = "power"
	Sqrt       Operation = "sqrt"
	Percentage Operation = "percentage"
)

var (
	ErrUnsupportedOperation = errors.New("unsupported operation")
	ErrMissingOperand       = errors.New("operation requires a second operand")
	ErrDivisionByZero       = errors.New("division by zero is not allowed")
	ErrNegativeSquareRoot   = errors.New("square root of a negative number is not supported")
	ErrResultOutOfRange     = errors.New("result is undefined or too large to represent")
)

type operation struct {
	unary bool
	apply func(a, b float64) (float64, error)
}

var operations = map[Operation]operation{
	Add:      {apply: func(a, b float64) (float64, error) { return a + b, nil }},
	Subtract: {apply: func(a, b float64) (float64, error) { return a - b, nil }},
	Multiply: {apply: func(a, b float64) (float64, error) { return a * b, nil }},
	Divide: {apply: func(a, b float64) (float64, error) {
		if b == 0 {
			return 0, ErrDivisionByZero
		}
		return a / b, nil
	}},
	Power: {apply: func(a, b float64) (float64, error) { return math.Pow(a, b), nil }},
	Sqrt: {unary: true, apply: func(a, _ float64) (float64, error) {
		if a < 0 {
			return 0, ErrNegativeSquareRoot
		}
		return math.Sqrt(a), nil
	}},
	// Percentage converts a value to its fraction of 100 (20 -> 0.2), like the
	// % key on most pocket calculators: "150 × 20 % =" yields 30.
	Percentage: {unary: true, apply: func(a, _ float64) (float64, error) { return a / 100, nil }},
}

// IsUnary reports whether op uses only the first operand.
// It returns false for unsupported operations.
func IsUnary(op Operation) bool {
	return operations[op].unary
}

// Calculate applies op to its operands. b must be non-nil for binary
// operations and is ignored for unary ones.
func Calculate(op Operation, a float64, b *float64) (float64, error) {
	o, ok := operations[op]
	if !ok {
		return 0, ErrUnsupportedOperation
	}

	var second float64
	if !o.unary {
		if b == nil {
			return 0, ErrMissingOperand
		}
		second = *b
	}

	result, err := o.apply(a, second)
	if err != nil {
		return 0, err
	}
	// Catches overflow (1e308 * 10), 0^-1, and fractional powers of negatives.
	if math.IsNaN(result) || math.IsInf(result, 0) {
		return 0, ErrResultOutOfRange
	}
	// Avoid returning -0, which is surprising to display (e.g. -5 * 0).
	if result == 0 {
		return 0, nil
	}
	return result, nil
}
