import { describe, expect, it } from 'vitest'
import { keyToAction } from './keyboard'

describe('keyToAction', () => {
  it.each([
    ['7', { type: 'digit', digit: '7' }],
    ['.', { type: 'decimal' }],
    [',', { type: 'decimal' }],
    ['+', { type: 'binaryOperator', op: 'add' }],
    ['-', { type: 'binaryOperator', op: 'subtract' }],
    ['*', { type: 'binaryOperator', op: 'multiply' }],
    ['X', { type: 'binaryOperator', op: 'multiply' }],
    ['/', { type: 'binaryOperator', op: 'divide' }],
    ['^', { type: 'binaryOperator', op: 'power' }],
    ['%', { type: 'unaryOperator', op: 'percentage' }],
    ['r', { type: 'unaryOperator', op: 'sqrt' }],
    ['n', { type: 'toggleSign' }],
    ['Enter', { type: 'equals' }],
    ['=', { type: 'equals' }],
    ['Backspace', { type: 'backspace' }],
    ['Escape', { type: 'clear' }],
  ])('maps %s', (key, action) => {
    expect(keyToAction(key)).toEqual(action)
  })

  it.each(['a', 'Tab', 'Shift', 'F5', 'ArrowUp'])('ignores %s', (key) => {
    expect(keyToAction(key)).toBeNull()
  })
})
