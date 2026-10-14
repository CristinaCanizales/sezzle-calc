import { OPERATOR_SYMBOLS, type Operator } from '../types'
import { formatNumber } from '../utils/format'

/**
 * Keypad state machine that builds an arithmetic expression as a list of
 * tokens. The server evaluates it with standard precedence, so
 * `2 + 3 × 4 =` gives 14.
 *
 * Input rules keep the expression well-formed while typing (e.g. `2 (`
 * becomes `2 × (`), but the server remains the authority on validity.
 *
 * Tokens are API-ready ASCII: numbers ("12", "0.5", "1.2e+21"), operators
 * (+ - * / ^), "(", ")", "sqrt" and "%".
 */
export interface CalculatorState {
  tokens: string[]
  /** `tokens` holds a result; typing a number starts a new expression. */
  evaluated: boolean
  /** Completed equation shown above the result, e.g. "2 + 3 × 4 =". */
  lastEquation: string | null
  error: string | null
  /** Expression being evaluated; key presses are ignored while it is set. */
  request: string | null
}

export type CalculatorAction =
  | { type: 'digit'; digit: string }
  | { type: 'decimal' }
  | { type: 'operator'; op: Operator }
  | { type: 'openParen' }
  | { type: 'closeParen' }
  | { type: 'sqrt' }
  | { type: 'percent' }
  | { type: 'backspace' }
  | { type: 'clear' }
  | { type: 'equals' }
  | { type: 'requestSucceeded'; result: number }
  | { type: 'requestFailed'; message: string }

export const MAX_DIGITS = 15
/** Kept below the server's 256-character limit. */
export const MAX_EXPRESSION_LENGTH = 200

export const initialState: CalculatorState = {
  tokens: [],
  evaluated: false,
  lastEquation: null,
  error: null,
  request: null,
}

const OPERATORS = new Set<string>(['+', '-', '*', '/', '^'])

const isNumber = (t: string | undefined) => t !== undefined && /^[0-9.]/.test(t)
const isOperator = (t: string | undefined) => t !== undefined && OPERATORS.has(t)
/** The token completes an operand, so a binary operator may follow it. */
const endsValue = (t: string | undefined) => isNumber(t) || t === ')' || t === '%'
const openParens = (tokens: string[]) =>
  tokens.reduce((n, t) => n + (t === '(' ? 1 : t === ')' ? -1 : 0), 0)

export function toApiExpression(tokens: string[]): string {
  return tokens.join(' ')
}

export function calculatorReducer(state: CalculatorState, action: CalculatorAction): CalculatorState {
  switch (action.type) {
    case 'requestSucceeded':
      return {
        ...initialState,
        tokens: resultTokens(action.result),
        evaluated: true,
        lastEquation: `${formatExpression(state.tokens)} =`,
      }
    case 'requestFailed':
      // Keep the expression so the user can fix it instead of retyping it.
      return { ...state, request: null, error: action.message }
  }

  // Ignore input while waiting for the server.
  if (state.request) return state
  if (action.type === 'clear') return initialState

  // Any key dismisses an error and continues editing the expression.
  const current = state.error ? { ...state, error: null } : state
  const tokens = editTokens(current, action)
  if (tokens === null) {
    return current
  }

  if (action.type === 'equals') {
    return { ...current, tokens, request: toApiExpression(tokens) }
  }
  if (toApiExpression(tokens).length > MAX_EXPRESSION_LENGTH) return current
  return { ...current, tokens, evaluated: false, lastEquation: null }
}

/** Returns the new token list, or null if the key press does not apply. */
function editTokens(state: CalculatorState, action: CalculatorAction): string[] | null {
  const { evaluated } = state
  // After a result, numbers and "(" start a new expression; operators continue from it.
  const tokens = evaluated && ['digit', 'decimal', 'openParen'].includes(action.type) ? [] : state.tokens
  const last = tokens.at(-1)

  switch (action.type) {
    case 'digit': {
      if (isNumber(last)) {
        if (last === '0') return [...tokens.slice(0, -1), action.digit]
        if (last!.replace(/\D/g, '').length >= MAX_DIGITS || last!.includes('e')) return null
        return [...tokens.slice(0, -1), last + action.digit]
      }
      return [...withImplicitMultiply(tokens), action.digit]
    }

    case 'decimal': {
      if (isNumber(last)) {
        return last!.includes('.') || last!.includes('e') ? null : [...tokens.slice(0, -1), `${last}.`]
      }
      return [...withImplicitMultiply(tokens), '0.']
    }

    case 'operator':
      return addOperator(tokens, action.op)

    case 'openParen':
      return [...withImplicitMultiply(tokens), '(']

    case 'closeParen':
      return openParens(tokens) > 0 && endsValue(last) ? [...tokens, ')'] : null

    case 'sqrt':
      return addSqrt(tokens, evaluated)

    case 'percent':
      return endsValue(last) ? [...tokens, '%'] : null

    case 'backspace': {
      if (evaluated || last === undefined) return null
      if (isNumber(last) && last.length > 1 && !last.includes('e')) {
        return [...tokens.slice(0, -1), last.slice(0, -1)]
      }
      return tokens.slice(0, -1)
    }

    case 'equals': {
      // Nothing to evaluate, or the expression is incomplete (e.g. "2 +").
      if (evaluated || tokens.length < 2 || !endsValue(last)) return null
      return [...tokens, ...Array<string>(openParens(tokens)).fill(')')]
    }

    default:
      return null
  }
}

/** Inserts "×" when a new operand directly follows a complete one: "2(" → "2 × (". */
function withImplicitMultiply(tokens: string[]): string[] {
  return endsValue(tokens.at(-1)) ? [...tokens, '*'] : tokens
}

function addOperator(tokens: string[], op: Operator): string[] | null {
  const last = tokens.at(-1)
  if (endsValue(last)) return [...tokens, op]

  // Minus as a sign: at the start, after "(", or after × ÷ ^ (e.g. "2 × −3").
  if (op === '-' && (last === undefined || last === '(' || last === '*' || last === '/' || last === '^')) {
    return [...tokens, '-']
  }

  // Otherwise replace trailing operators, e.g. "2 × −" then "+" gives "2 +".
  let trimmed = tokens
  while (isOperator(trimmed.at(-1))) trimmed = trimmed.slice(0, -1)
  return endsValue(trimmed.at(-1)) ? [...trimmed, op] : null
}

/**
 * √ works both before and after its operand: "√ 9" and "9 √" both give √9.
 * Applied after a parenthesized group or a percentage, it wraps it in parentheses.
 */
function addSqrt(tokens: string[], evaluated: boolean): string[] {
  if (evaluated) {
    return tokens.length === 1 ? ['sqrt', ...tokens] : ['sqrt', '(', ...tokens, ')']
  }
  const last = tokens.at(-1)
  if (!endsValue(last)) return [...tokens, 'sqrt']

  const start = operandStart(tokens)
  const operand = tokens.slice(start)
  const wrapped = operand.length === 1 || operand[0] === '(' ? operand : ['(', ...operand, ')']
  return [...tokens.slice(0, start), 'sqrt', ...wrapped]
}

/** Index where the trailing operand starts, e.g. the "(" matching a final ")". */
function operandStart(tokens: string[]): number {
  let i = tokens.length - 1
  while (tokens[i] === '%') i--
  if (tokens[i] === ')') {
    let depth = 0
    for (; i >= 0; i--) {
      if (tokens[i] === ')') depth++
      if (tokens[i] === '(' && --depth === 0) break
    }
  }
  while (tokens[i - 1] === 'sqrt') i--
  return i
}

function resultTokens(result: number): string[] {
  const text = formatNumber(result)
  return text.startsWith('-') ? ['-', text.slice(1)] : [text]
}

const TOKEN_SYMBOLS: Record<string, string> = { ...OPERATOR_SYMBOLS, sqrt: '√' }

/** Human-readable expression, e.g. ["2","*","-","3"] → "2 × −3". */
export function formatExpression(tokens: string[]): string {
  return tokens
    .map((token, i) => {
      const symbol = TOKEN_SYMBOLS[token] ?? token
      // Binary operators get spaces; signs, parentheses, √ and % stay attached.
      return isOperator(token) && endsValue(tokens[i - 1]) ? ` ${symbol} ` : symbol
    })
    .join('')
    .trim()
}

/** Main display text: the error, the expression being typed, or the result. */
export function getDisplay(state: CalculatorState): string {
  if (state.error) return state.error
  return state.tokens.length ? formatExpression(state.tokens) : '0'
}

/** Secondary line: the finished equation after "=", or the expression an error refers to. */
export function getExpression(state: CalculatorState): string {
  if (state.error) return formatExpression(state.tokens)
  return state.lastEquation ?? ''
}
