import type { CalculatorAction } from './calculatorReducer'

const KEY_ACTIONS: Record<string, CalculatorAction> = {
  '.': { type: 'decimal' },
  ',': { type: 'decimal' },
  '+': { type: 'operator', op: '+' },
  '-': { type: 'operator', op: '-' },
  '*': { type: 'operator', op: '*' },
  x: { type: 'operator', op: '*' },
  '/': { type: 'operator', op: '/' },
  '^': { type: 'operator', op: '^' },
  '(': { type: 'openParen' },
  ')': { type: 'closeParen' },
  '%': { type: 'percent' },
  r: { type: 'sqrt' },
  '=': { type: 'equals' },
  Enter: { type: 'equals' },
  Backspace: { type: 'backspace' },
  Escape: { type: 'clear' },
  Delete: { type: 'clear' },
}

/** Maps a KeyboardEvent.key to a calculator action, or null if the key is not handled. */
export function keyToAction(key: string): CalculatorAction | null {
  if (/^[0-9]$/.test(key)) return { type: 'digit', digit: key }
  return KEY_ACTIONS[key.length === 1 ? key.toLowerCase() : key] ?? null
}
