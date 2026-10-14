package calculator

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"
)

// MaxExpressionLength bounds the input size (and therefore parser recursion depth).
const MaxExpressionLength = 256

// ErrInvalidExpression is matched by every *SyntaxError via errors.Is.
var ErrInvalidExpression = errors.New("invalid expression")

// SyntaxError describes why an expression could not be parsed.
// Pos is the 1-based character position of the problem.
type SyntaxError struct {
	Pos int
	Msg string
}

func (e *SyntaxError) Error() string { return fmt.Sprintf("%s at position %d", e.Msg, e.Pos) }
func (e *SyntaxError) Unwrap() error { return ErrInvalidExpression }

// Evaluate parses and evaluates an arithmetic expression with standard precedence:
//
//	expression = term { ("+" | "-") term }
//	term       = unary { ("*" | "/") unary }
//	unary      = ("-" | "+") unary | power
//	power      = postfix [ "^" unary ]          (right-associative)
//	postfix    = primary { "%" }
//	primary    = number | "(" expression ")" | ("√" | "sqrt") primary
//
// Unary minus binds looser than "^", so -2^2 = -4 as in standard notation.
// Each operation is computed by Calculate, so domain rules (division by zero,
// negative square roots, overflow) match the single-operation endpoint.
// The whole expression is parsed before anything is evaluated, so syntax
// errors are always reported ahead of math errors.
func Evaluate(expr string) (float64, error) {
	if utf8.RuneCountInString(expr) > MaxExpressionLength {
		return 0, &SyntaxError{Pos: MaxExpressionLength + 1, Msg: fmt.Sprintf("expression is longer than %d characters", MaxExpressionLength)}
	}
	tokens, err := tokenize(expr)
	if err != nil {
		return 0, err
	}
	p := &parser{tokens: tokens}
	if p.peek().kind == tokenEOF {
		return 0, &SyntaxError{Pos: 1, Msg: "expression is empty"}
	}
	root, err := p.parseExpression()
	if err != nil {
		return 0, err
	}
	if tok := p.peek(); tok.kind != tokenEOF {
		return 0, unexpected(tok)
	}

	result, err := root.eval()
	if err != nil {
		return 0, err
	}
	if result == 0 {
		return 0, nil // normalize -0
	}
	return result, nil
}

// --- Tokenizer ---

type tokenKind int

const (
	tokenEOF tokenKind = iota
	tokenNumber
	tokenOperator // + - * / ^
	tokenLParen
	tokenRParen
	tokenSqrt
	tokenPercent
)

type token struct {
	kind  tokenKind
	text  string
	op    rune // normalized operator for tokenOperator
	value float64
	pos   int
}

// Unicode symbols shown on the keypad are accepted alongside ASCII.
var operatorAliases = map[rune]rune{'+': '+', '-': '-', '−': '-', '*': '*', '×': '*', '/': '/', '÷': '/', '^': '^'}

func tokenize(expr string) ([]token, error) {
	runes := []rune(expr)
	var tokens []token

	for i := 0; i < len(runes); {
		r, pos := runes[i], i+1
		switch {
		case unicode.IsSpace(r):
			i++
		case unicode.IsDigit(r) || r == '.':
			start := i
			for i < len(runes) && (unicode.IsDigit(runes[i]) || runes[i] == '.') {
				i++
			}
			// Optional exponent, e.g. 1.5e+21 (results can be displayed this way).
			if i < len(runes) && (runes[i] == 'e' || runes[i] == 'E') {
				j := i + 1
				if j < len(runes) && (runes[j] == '+' || runes[j] == '-') {
					j++
				}
				if j < len(runes) && unicode.IsDigit(runes[j]) {
					for j < len(runes) && unicode.IsDigit(runes[j]) {
						j++
					}
					i = j
				}
			}
			text := string(runes[start:i])
			value, err := strconv.ParseFloat(text, 64)
			if errors.Is(err, strconv.ErrRange) {
				return nil, ErrResultOutOfRange
			}
			if err != nil {
				return nil, &SyntaxError{Pos: pos, Msg: fmt.Sprintf("invalid number %q", text)}
			}
			tokens = append(tokens, token{kind: tokenNumber, text: text, value: value, pos: pos})
		case unicode.IsLetter(r):
			start := i
			for i < len(runes) && unicode.IsLetter(runes[i]) {
				i++
			}
			word := string(runes[start:i])
			if strings.ToLower(word) != "sqrt" {
				return nil, &SyntaxError{Pos: pos, Msg: fmt.Sprintf("unknown name %q", word)}
			}
			tokens = append(tokens, token{kind: tokenSqrt, text: word, pos: pos})
		default:
			tok := token{text: string(r), pos: pos}
			if op, ok := operatorAliases[r]; ok {
				tok.kind, tok.op = tokenOperator, op
			} else {
				switch r {
				case '(':
					tok.kind = tokenLParen
				case ')':
					tok.kind = tokenRParen
				case '√':
					tok.kind = tokenSqrt
				case '%':
					tok.kind = tokenPercent
				default:
					return nil, &SyntaxError{Pos: pos, Msg: fmt.Sprintf("unexpected character %q", r)}
				}
			}
			tokens = append(tokens, tok)
			i++
		}
	}
	return append(tokens, token{kind: tokenEOF, pos: len(runes) + 1}), nil
}

// --- Parser (recursive descent, builds an AST) ---

type node interface {
	eval() (float64, error)
}

type numberNode float64

type negateNode struct{ operand node }

type unaryNode struct {
	op      Operation // Sqrt or Percentage
	operand node
}

type binaryNode struct {
	op          Operation
	left, right node
}

func (n numberNode) eval() (float64, error) { return float64(n), nil }

func (n negateNode) eval() (float64, error) {
	v, err := n.operand.eval()
	return -v, err
}

func (n unaryNode) eval() (float64, error) {
	v, err := n.operand.eval()
	if err != nil {
		return 0, err
	}
	return Calculate(n.op, v, nil)
}

func (n binaryNode) eval() (float64, error) {
	l, err := n.left.eval()
	if err != nil {
		return 0, err
	}
	r, err := n.right.eval()
	if err != nil {
		return 0, err
	}
	return Calculate(n.op, l, &r)
}

var binaryOperations = map[rune]Operation{'+': Add, '-': Subtract, '*': Multiply, '/': Divide, '^': Power}

type parser struct {
	tokens []token
	pos    int
}

func (p *parser) peek() token { return p.tokens[p.pos] }

func (p *parser) next() token {
	tok := p.tokens[p.pos]
	if tok.kind != tokenEOF {
		p.pos++
	}
	return tok
}

func (p *parser) isOperator(ops ...rune) bool {
	tok := p.peek()
	if tok.kind != tokenOperator {
		return false
	}
	for _, op := range ops {
		if tok.op == op {
			return true
		}
	}
	return false
}

// parseLeftAssoc parses `operand { op operand }` for the given operators.
func (p *parser) parseLeftAssoc(operand func() (node, error), ops ...rune) (node, error) {
	left, err := operand()
	if err != nil {
		return nil, err
	}
	for p.isOperator(ops...) {
		op := p.next().op
		right, err := operand()
		if err != nil {
			return nil, err
		}
		left = binaryNode{op: binaryOperations[op], left: left, right: right}
	}
	return left, nil
}

func (p *parser) parseExpression() (node, error) {
	return p.parseLeftAssoc(p.parseTerm, '+', '-')
}

func (p *parser) parseTerm() (node, error) {
	return p.parseLeftAssoc(p.parseUnary, '*', '/')
}

func (p *parser) parseUnary() (node, error) {
	if p.isOperator('+', '-') {
		op := p.next().op
		operand, err := p.parseUnary()
		if err != nil {
			return nil, err
		}
		if op == '-' {
			return negateNode{operand}, nil
		}
		return operand, nil
	}
	return p.parsePower()
}

func (p *parser) parsePower() (node, error) {
	base, err := p.parsePostfix()
	if err != nil {
		return nil, err
	}
	if !p.isOperator('^') {
		return base, nil
	}
	p.next()
	exponent, err := p.parseUnary() // recursion makes ^ right-associative and allows 2^-1
	if err != nil {
		return nil, err
	}
	return binaryNode{op: Power, left: base, right: exponent}, nil
}

func (p *parser) parsePostfix() (node, error) {
	operand, err := p.parsePrimary()
	if err != nil {
		return nil, err
	}
	for p.peek().kind == tokenPercent {
		p.next()
		operand = unaryNode{op: Percentage, operand: operand}
	}
	return operand, nil
}

func (p *parser) parsePrimary() (node, error) {
	tok := p.next()
	switch tok.kind {
	case tokenNumber:
		return numberNode(tok.value), nil
	case tokenLParen:
		inner, err := p.parseExpression()
		if err != nil {
			return nil, err
		}
		if closing := p.next(); closing.kind != tokenRParen {
			if closing.kind == tokenEOF {
				return nil, &SyntaxError{Pos: tok.pos, Msg: `missing ")" for "("`}
			}
			return nil, unexpected(closing)
		}
		return inner, nil
	case tokenSqrt:
		operand, err := p.parsePrimary()
		if err != nil {
			return nil, err
		}
		return unaryNode{op: Sqrt, operand: operand}, nil
	default:
		return nil, unexpected(tok)
	}
}

func unexpected(tok token) error {
	if tok.kind == tokenEOF {
		return &SyntaxError{Pos: tok.pos, Msg: "unexpected end of expression"}
	}
	return &SyntaxError{Pos: tok.pos, Msg: fmt.Sprintf("unexpected %q", tok.text)}
}
