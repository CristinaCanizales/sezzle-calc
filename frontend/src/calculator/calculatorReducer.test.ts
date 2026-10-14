import { describe, expect, it } from 'vitest'
import type { Operator } from '../types'
import {
  calculatorReducer,
  getDisplay,
  getExpression,
  initialState,
  MAX_DIGITS,
  MAX_EXPRESSION_LENGTH,
  type CalculatorAction,
  type CalculatorState,
} from './calculatorReducer'

const SHORTHAND: Record<string, CalculatorAction> = {
  '.': { type: 'decimal' },
  '(': { type: 'openParen' },
  ')': { type: 'closeParen' },
  '√': { type: 'sqrt' },
  '%': { type: 'percent' },
  '=': { type: 'equals' },
  '<': { type: 'backspace' },
  C: { type: 'clear' },
  ...Object.fromEntries(['+', '-', '*', '/', '^'].map((op) => [op, { type: 'operator', op: op as Operator }])),
}

/** Types keys from a compact string, e.g. "2+3*4=" ("<" is backspace, "C" is clear). */
function type(keys: string, state: CalculatorState = initialState): CalculatorState {
  return [...keys].reduce((s, key) => {
    const action = /\d/.test(key) ? { type: 'digit' as const, digit: key } : SHORTHAND[key]
    return calculatorReducer(s, action)
  }, state)
}

const succeed = (state: CalculatorState, result: number) =>
  calculatorReducer(state, { type: 'requestSucceeded', result })

describe('number entry', () => {
  it('shows 0 when empty and replaces a leading zero', () => {
    expect(getDisplay(initialState)).toBe('0')
    expect(getDisplay(type('007'))).toBe('7')
  })

  it('allows one decimal point per number and prefixes a bare point with 0', () => {
    expect(getDisplay(type('1.2.3'))).toBe('1.23')
    expect(getDisplay(type('.5+.5'))).toBe('0.5 + 0.5')
  })

  it(`limits each number to ${MAX_DIGITS} digits`, () => {
    expect(getDisplay(type('1234567890123456789'))).toBe('123456789012345')
  })

  it('backspace removes the last character, then whole tokens', () => {
    expect(getDisplay(type('12+34<'))).toBe('12 + 3')
    expect(getDisplay(type('12+34<<<'))).toBe('12')
    expect(getDisplay(type('√(<<'))).toBe('0')
  })

  it('clears everything', () => {
    expect(type('2+3C')).toEqual(initialState)
  })
})

describe('building expressions', () => {
  it('sends the whole expression so the server can apply precedence', () => {
    const state = type('2+3*4=')
    expect(state.request).toBe('2 + 3 * 4')
    expect(getDisplay(state)).toBe('2 + 3 × 4')
  })

  it('shows the result and the completed equation', () => {
    const state = succeed(type('2+3*4='), 14)
    expect(getDisplay(state)).toBe('14')
    expect(getExpression(state)).toBe('2 + 3 × 4 =')
    expect(state.request).toBeNull()
  })

  it('supports parentheses and closes any left open on =', () => {
    expect(type('(2+3)*4=').request).toBe('( 2 + 3 ) * 4')
    expect(type('2*(3+(4=').request).toBe('2 * ( 3 + ( 4 ) )')
  })

  it('only closes a parenthesis that is open and follows a value', () => {
    expect(getDisplay(type('2)'))).toBe('2')
    expect(getDisplay(type('(2+)'))).toBe('(2 +')
  })

  it('inserts × between adjacent operands', () => {
    expect(type('2(3)=').request).toBe('2 * ( 3 )')
    expect(type('(2)3=').request).toBe('( 2 ) * 3')
    expect(type('5%2=').request).toBe('5 % * 2')
  })

  it('replaces an operator pressed right after another', () => {
    expect(getDisplay(type('5+*'))).toBe('5 ×')
  })

  it('treats minus as a sign at the start, after "(" and after × ÷ ^', () => {
    expect(type('-5+3=').request).toBe('- 5 + 3')
    expect(type('2*-3=').request).toBe('2 * - 3')
    expect(getDisplay(type('2*-3'))).toBe('2 × −3')
    expect(type('2^-1=').request).toBe('2 ^ - 1')
    expect(type('(-2)=').request).toBe('( - 2 )')
  })

  it('replaces a sign and its operator when another operator follows', () => {
    expect(getDisplay(type('2*-+'))).toBe('2 +')
  })

  it('ignores operators that cannot follow the previous token', () => {
    expect(getDisplay(type('*'))).toBe('0')
    expect(getDisplay(type('(*'))).toBe('(')
    expect(getDisplay(type('%'))).toBe('0')
  })

  it('ignores = for incomplete or trivial expressions', () => {
    expect(type('2+=').request).toBeNull()
    expect(type('5=').request).toBeNull()
    expect(type('=').request).toBeNull()
  })

  it(`stops accepting input beyond ${MAX_EXPRESSION_LENGTH} characters`, () => {
    const state = type('1+'.repeat(MAX_EXPRESSION_LENGTH))
    expect(state.tokens.join(' ').length).toBeLessThanOrEqual(MAX_EXPRESSION_LENGTH)
  })

  it('ignores key presses while a request is in flight', () => {
    const inFlight = type('2+3=')
    expect(calculatorReducer(inFlight, { type: 'digit', digit: '9' })).toBe(inFlight)
  })
})

describe('square root and percent', () => {
  it('works as a prefix: √ then a number', () => {
    expect(type('√9+1=').request).toBe('sqrt 9 + 1')
    expect(getDisplay(type('√9+1'))).toBe('√9 + 1')
  })

  it('works after a number, applying to that number', () => {
    expect(type('2+9√=').request).toBe('2 + sqrt 9')
  })

  it('wraps a parenthesized group or percentage', () => {
    expect(type('(9+7)√=').request).toBe('sqrt ( 9 + 7 )')
    expect(type('20%√=').request).toBe('sqrt ( 20 % )')
  })

  it('does not allow a sign directly after √', () => {
    expect(getDisplay(type('√-'))).toBe('√')
  })

  it('appends % to the preceding value', () => {
    expect(type('150*20%=').request).toBe('150 * 20 %')
  })
})

describe('after a result', () => {
  const evaluated = succeed(type('2+3='), 5)

  it('starts a new expression when a number is typed', () => {
    const state = type('7', evaluated)
    expect(getDisplay(state)).toBe('7')
    expect(getExpression(state)).toBe('')
  })

  it('continues from the result when an operator is pressed', () => {
    expect(type('*2=', evaluated).request).toBe('5 * 2')
  })

  it('applies √ and % to the result', () => {
    expect(type('√=', evaluated).request).toBe('sqrt 5')
    expect(type('%=', evaluated).request).toBe('5 %')
  })

  it('keeps a negative result usable as an operand', () => {
    const negative = succeed(type('2-5='), -3)
    expect(getDisplay(negative)).toBe('−3')
    expect(type('*2=', negative).request).toBe('- 3 * 2')
    expect(type('√=', negative).request).toBe('sqrt ( - 3 )')
  })

  it('rounds floating-point noise in the result', () => {
    expect(getDisplay(succeed(type('.1+.2='), 0.1 + 0.2))).toBe('0.3')
  })

  it('does not let backspace edit the result', () => {
    expect(getDisplay(type('<', evaluated))).toBe('5')
  })
})

describe('errors', () => {
  const failed = calculatorReducer(type('5/0='), {
    type: 'requestFailed',
    message: 'Division by zero is not allowed.',
  })

  it('shows the error and keeps the expression for editing', () => {
    expect(getDisplay(failed)).toBe('Division by zero is not allowed.')
    expect(getExpression(failed)).toBe('5 ÷ 0')
    expect(failed.request).toBeNull()
  })

  it('dismisses the error and edits the expression on the next key', () => {
    const fixed = type('<2', failed)
    expect(fixed.error).toBeNull()
    expect(getDisplay(fixed)).toBe('5 ÷ 2')
    expect(type('=', fixed).request).toBe('5 / 2')
  })
})
