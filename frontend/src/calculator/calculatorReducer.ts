import {
  OPERATION_SYMBOLS,
  UNARY_OPERATIONS,
  type BinaryOperation,
  type CalculateRequest,
  type UnaryOperation,
} from '../types'
import { formatNumber } from '../utils/format'

/**
 * Pocket-calculator state machine with immediate execution: each operation is
 * evaluated as soon as it is complete, so `2 + 3 × 4 =` gives 20 (no precedence).
 *
 * The reducer is pure. Keys that need a calculation set `request`; the
 * useCalculator hook sends it and dispatches the outcome back.
 */
export interface CalculatorState {
  /** Text in the main display: the number being typed or the latest result. */
  display: string
  /** Left-hand operand waiting for `pendingOp`. */
  accumulator: number | null
  pendingOp: BinaryOperation | null
  /** The next digit starts a new number instead of appending. */
  overwrite: boolean
  /** The display holds an operand entered after the last operator. */
  operandReady: boolean
  /** Completed equation shown above the result after `=`, e.g. "12 + 3 =". */
  lastEquation: string | null
  error: string | null
  /** In-flight calculation; key presses are ignored while it is set. */
  request: CalculateRequest | null
  /** Operator to chain once the in-flight binary request resolves. */
  nextOp: BinaryOperation | null
}

export type CalculatorAction =
  | { type: 'digit'; digit: string }
  | { type: 'decimal' }
  | { type: 'toggleSign' }
  | { type: 'backspace' }
  | { type: 'clear' }
  | { type: 'binaryOperator'; op: BinaryOperation }
  | { type: 'unaryOperator'; op: UnaryOperation }
  | { type: 'equals' }
  | { type: 'requestSucceeded'; result: number }
  | { type: 'requestFailed'; message: string }

export const MAX_DIGITS = 15

export const initialState: CalculatorState = {
  display: '0',
  accumulator: null,
  pendingOp: null,
  overwrite: false,
  operandReady: true,
  lastEquation: null,
  error: null,
  request: null,
  nextOp: null,
}

export function calculatorReducer(state: CalculatorState, action: CalculatorAction): CalculatorState {
  if (action.type === 'requestSucceeded') return applyResult(state, action.result)
  if (action.type === 'requestFailed') return { ...initialState, error: action.message }

  // Ignore input while waiting for the server.
  if (state.request) return state

  if (action.type === 'clear') return initialState

  // After an error only starting a new number (or clearing) does anything.
  if (state.error) {
    if (action.type === 'digit' || action.type === 'decimal') {
      return calculatorReducer(initialState, action)
    }
    return state
  }

  switch (action.type) {
    case 'digit':
      return enterDigit(state, action.digit)
    case 'decimal':
      return enterDecimal(state)
    case 'toggleSign':
      return toggleSign(state)
    case 'backspace':
      return backspace(state)
    case 'binaryOperator':
      return chooseOperator(state, action.op)
    case 'unaryOperator':
      return {
        ...state,
        lastEquation: null,
        request: { operation: action.op, a: Number(state.display) },
      }
    case 'equals':
      if (state.pendingOp === null || state.accumulator === null || !state.operandReady) return state
      return {
        ...state,
        request: { operation: state.pendingOp, a: state.accumulator, b: Number(state.display) },
        nextOp: null,
      }
  }
}

function startTyping(state: CalculatorState, display: string): CalculatorState {
  return { ...state, display, overwrite: false, operandReady: true, lastEquation: null }
}

function digitCount(display: string): number {
  return display.replace(/[^0-9]/g, '').length
}

function enterDigit(state: CalculatorState, digit: string): CalculatorState {
  if (state.overwrite) return startTyping(state, digit)
  if (state.display === '0') return startTyping(state, digit)
  if (state.display === '-0') return startTyping(state, `-${digit}`)
  if (digitCount(state.display) >= MAX_DIGITS) return state
  return startTyping(state, state.display + digit)
}

function enterDecimal(state: CalculatorState): CalculatorState {
  if (state.overwrite) return startTyping(state, '0.')
  if (state.display.includes('.')) return state
  return startTyping(state, `${state.display}.`)
}

function toggleSign(state: CalculatorState): CalculatorState {
  // Right after choosing an operator, ± starts a negative second operand.
  if (state.pendingOp && !state.operandReady) return startTyping(state, '-0')

  const display = state.display.startsWith('-') ? state.display.slice(1) : `-${state.display}`
  // Keep `overwrite` so negating a result and then typing starts a new number.
  return { ...state, display, operandReady: true, lastEquation: null }
}

function backspace(state: CalculatorState): CalculatorState {
  // Results are not editable; only numbers being typed are.
  if (state.overwrite) return state
  const display = state.display.slice(0, -1)
  return startTyping(state, display === '' || display === '-' ? '0' : display)
}

function chooseOperator(state: CalculatorState, op: BinaryOperation): CalculatorState {
  // A complete expression is pending: evaluate it, then continue with `op`.
  if (state.pendingOp && state.accumulator !== null && state.operandReady) {
    return {
      ...state,
      request: { operation: state.pendingOp, a: state.accumulator, b: Number(state.display) },
      nextOp: op,
    }
  }
  // Pressing operators back to back replaces the previous one.
  return {
    ...state,
    accumulator: state.pendingOp ? state.accumulator : Number(state.display),
    pendingOp: op,
    overwrite: true,
    operandReady: false,
    lastEquation: null,
  }
}

function applyResult(state: CalculatorState, result: number): CalculatorState {
  const { request } = state
  if (!request) return state
  const display = formatNumber(result)
  const done = { ...state, display, overwrite: true, request: null, nextOp: null }

  if (UNARY_OPERATIONS.includes(request.operation)) {
    // The result becomes the current operand, e.g. "150 × 20 % =" → 150 × 0.2.
    return { ...done, operandReady: true }
  }

  const op = request.operation as BinaryOperation
  if (state.nextOp) {
    // The displayed (rounded) value is what the user sees, so chain from it.
    return { ...done, accumulator: Number(display), pendingOp: state.nextOp, operandReady: false }
  }
  return {
    ...done,
    accumulator: null,
    pendingOp: null,
    operandReady: true,
    lastEquation: `${formatNumber(request.a)} ${OPERATION_SYMBOLS[op]} ${formatNumber(request.b ?? 0)} =`,
  }
}

/** Secondary display line: the pending operation or the last completed equation. */
export function getExpression(state: CalculatorState): string {
  if (state.pendingOp && state.accumulator !== null) {
    return `${formatNumber(state.accumulator)} ${OPERATION_SYMBOLS[state.pendingOp]}`
  }
  return state.lastEquation ?? ''
}
