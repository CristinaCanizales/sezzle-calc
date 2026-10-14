import { describe, expect, it } from 'vitest'
import {
  calculatorReducer,
  getExpression,
  initialState,
  MAX_DIGITS,
  type CalculatorAction,
  type CalculatorState,
} from './calculatorReducer'

const digit = (d: string): CalculatorAction => ({ type: 'digit', digit: d })
const decimal: CalculatorAction = { type: 'decimal' }
const add: CalculatorAction = { type: 'binaryOperator', op: 'add' }
const multiply: CalculatorAction = { type: 'binaryOperator', op: 'multiply' }
const equals: CalculatorAction = { type: 'equals' }
const succeed = (result: number): CalculatorAction => ({ type: 'requestSucceeded', result })

/** Applies actions in order; a string is shorthand for typing its characters. */
function press(...inputs: (CalculatorAction | string)[]): CalculatorState {
  return inputs.reduce<CalculatorState>((state, input) => {
    if (typeof input !== 'string') return calculatorReducer(state, input)
    return [...input].reduce(
      (s, ch) => calculatorReducer(s, ch === '.' ? decimal : digit(ch)),
      state,
    )
  }, initialState)
}

describe('number entry', () => {
  it('starts at 0 and replaces the leading zero', () => {
    expect(initialState.display).toBe('0')
    expect(press('007').display).toBe('7')
  })

  it('allows only one decimal point', () => {
    expect(press('1.2.3').display).toBe('1.23')
  })

  it('prefixes a leading decimal point with 0', () => {
    expect(press('.5').display).toBe('0.5')
  })

  it(`stops accepting digits after ${MAX_DIGITS}`, () => {
    expect(press('1234567890123456789').display).toBe('123456789012345')
  })

  it('toggles the sign of the current number', () => {
    expect(press('12', { type: 'toggleSign' }).display).toBe('-12')
    expect(press('12', { type: 'toggleSign' }, { type: 'toggleSign' }).display).toBe('12')
  })

  it('starts a negative second operand when ± is pressed right after an operator', () => {
    expect(press('5', add, { type: 'toggleSign' }, '3').display).toBe('-3')
  })

  it('deletes the last character and falls back to 0', () => {
    expect(press('123', { type: 'backspace' }).display).toBe('12')
    expect(press('-5', { type: 'backspace' }).display).toBe('0')
  })

  it('does not edit a result with backspace', () => {
    const state = press('2', add, '3', equals, succeed(5), { type: 'backspace' })
    expect(state.display).toBe('5')
  })

  it('clears everything', () => {
    expect(press('5', add, '3', { type: 'clear' })).toEqual(initialState)
  })
})

describe('binary operations', () => {
  it('builds the request when = completes an expression', () => {
    const state = press('12', add, '3', equals)
    expect(state.request).toEqual({ operation: 'add', a: 12, b: 3 })
  })

  it('shows the result and the completed equation', () => {
    const state = press('12', add, '3', equals, succeed(15))
    expect(state.display).toBe('15')
    expect(state.request).toBeNull()
    expect(getExpression(state)).toBe('12 + 3 =')
  })

  it('shows the pending operation while typing the second operand', () => {
    expect(getExpression(press('12', add, '3'))).toBe('12 +')
  })

  it('replaces the operator when two are pressed in a row', () => {
    const state = press('5', add, multiply, '2', equals)
    expect(state.request).toEqual({ operation: 'multiply', a: 5, b: 2 })
  })

  it('evaluates the pending expression before chaining a new operator (no precedence)', () => {
    let state = press('2', add, '3', multiply)
    expect(state.request).toEqual({ operation: 'add', a: 2, b: 3 })

    state = press('2', add, '3', multiply, succeed(5), '4', equals)
    expect(state.request).toEqual({ operation: 'multiply', a: 5, b: 4 })
  })

  it('continues from a result when an operator follows =', () => {
    const state = press('2', add, '3', equals, succeed(5), multiply, '2', equals)
    expect(state.request).toEqual({ operation: 'multiply', a: 5, b: 2 })
  })

  it('starts a new number when typing after a result', () => {
    const state = press('2', add, '3', equals, succeed(5), '7')
    expect(state.display).toBe('7')
    expect(getExpression(state)).toBe('')
  })

  it('ignores = when there is nothing to evaluate', () => {
    expect(press('5', equals).request).toBeNull()
    expect(press('5', add, equals).request).toBeNull()
  })

  it('ignores key presses while a request is in flight', () => {
    const inFlight = press('2', add, '3', equals)
    expect(calculatorReducer(inFlight, digit('9'))).toBe(inFlight)
  })

  it('rounds floating-point noise in the display', () => {
    expect(press('0.1', add, '0.2', equals, succeed(0.1 + 0.2)).display).toBe('0.3')
  })
})

describe('unary operations', () => {
  it('applies square root to the displayed number', () => {
    let state = press('9', { type: 'unaryOperator', op: 'sqrt' })
    expect(state.request).toEqual({ operation: 'sqrt', a: 9 })
    state = calculatorReducer(state, succeed(3))
    expect(state.display).toBe('3')
  })

  it('uses a percentage result as the second operand', () => {
    const state = press('150', multiply, '20', { type: 'unaryOperator', op: 'percentage' }, succeed(0.2), equals)
    expect(state.request).toEqual({ operation: 'multiply', a: 150, b: 0.2 })
  })
})

describe('errors', () => {
  const failed = press('5', { type: 'binaryOperator', op: 'divide' }, '0', equals, {
    type: 'requestFailed',
    message: 'Division by zero is not allowed.',
  })

  it('shows the error and resets the calculation', () => {
    expect(failed.error).toBe('Division by zero is not allowed.')
    expect(failed.pendingOp).toBeNull()
    expect(failed.request).toBeNull()
  })

  it('ignores operators until a new number is entered', () => {
    expect(calculatorReducer(failed, add)).toBe(failed)
  })

  it('recovers when a digit is typed', () => {
    const state = calculatorReducer(failed, digit('4'))
    expect(state.error).toBeNull()
    expect(state.display).toBe('4')
  })
})
