import type { CalculatorAction } from '../calculator/calculatorReducer'
import { messages } from '../messages'

type KeyVariant = 'digit' | 'function' | 'operator' | 'equals'

interface KeyConfig {
  id: string
  label: string
  ariaLabel?: string
  shortcut: string
  action: CalculatorAction
  variant: KeyVariant
  className?: string
}

type NamedKey = keyof typeof messages.keys

const named = (
  id: NamedKey,
  shortcut: string,
  action: CalculatorAction,
  variant: KeyVariant,
  className?: string,
): KeyConfig => ({ id, ...messages.keys[id], shortcut, action, variant, className })

// Digits are universal, so they need no text entry or aria-label.
const digit = (d: string, className?: string): KeyConfig => ({
  id: d,
  label: d,
  shortcut: d,
  action: { type: 'digit', digit: d },
  variant: 'digit',
  className,
})

// Order matters: CSS grid auto-placement lays these out in a 4-column grid.
const KEYS: KeyConfig[] = [
  named('clear', 'Escape', { type: 'clear' }, 'function'),
  named('openParen', '(', { type: 'openParen' }, 'function'),
  named('closeParen', ')', { type: 'closeParen' }, 'function'),
  named('divide', '/', { type: 'operator', op: '/' }, 'operator'),
  named('sqrt', 'R', { type: 'sqrt' }, 'function'),
  named('power', '^', { type: 'operator', op: '^' }, 'function'),
  named('percentage', '%', { type: 'percent' }, 'function'),
  named('multiply', '*', { type: 'operator', op: '*' }, 'operator'),
  digit('7'),
  digit('8'),
  digit('9'),
  named('subtract', '-', { type: 'operator', op: '-' }, 'operator'),
  digit('4'),
  digit('5'),
  digit('6'),
  named('add', '+', { type: 'operator', op: '+' }, 'operator'),
  digit('1'),
  digit('2'),
  digit('3'),
  named('equals', 'Enter', { type: 'equals' }, 'equals', 'key--tall'),
  digit('0'),
  named('decimal', '.', { type: 'decimal' }, 'digit'),
  named('backspace', 'Backspace', { type: 'backspace' }, 'digit'),
]

interface KeypadProps {
  onPress: (action: CalculatorAction) => void
}

export function Keypad({ onPress }: KeypadProps) {
  return (
    <div className="keypad" role="group" aria-label={messages.calculator.keypadLabel}>
      {KEYS.map((key) => (
        <button
          key={key.id}
          type="button"
          className={`key key--${key.variant} ${key.className ?? ''}`}
          aria-label={key.ariaLabel}
          aria-keyshortcuts={key.shortcut}
          onClick={() => onPress(key.action)}
        >
          {key.label}
        </button>
      ))}
    </div>
  )
}
