import { describe, expect, it } from 'vitest'
import { keyToAction } from './keyboard'

describe('keyToAction', () => {
  it.each([
    ['7', { type: 'digit', digit: '7' }],
    ['.', { type: 'decimal' }],
    [',', { type: 'decimal' }],
    ['+', { type: 'operator', op: '+' }],
    ['-', { type: 'operator', op: '-' }],
    ['*', { type: 'operator', op: '*' }],
    ['X', { type: 'operator', op: '*' }],
    ['/', { type: 'operator', op: '/' }],
    ['^', { type: 'operator', op: '^' }],
    ['(', { type: 'openParen' }],
    [')', { type: 'closeParen' }],
    ['%', { type: 'percent' }],
    ['r', { type: 'sqrt' }],
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
