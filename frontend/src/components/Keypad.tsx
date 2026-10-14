import type { CalculatorAction } from '../calculator/calculatorReducer'
import { strings } from '../strings'

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

type NamedKey = keyof typeof strings.keys

const named = (
  id: NamedKey,
  shortcut: string,
  action: CalculatorAction,
  variant: KeyVariant,
  className?: string,
): KeyConfig => ({ id, ...strings.keys[id], shortcut, action, variant, className })

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
  named('backspace', 'Backspace', { type: 'backspace' }, 'function'),
  named('percentage', '%', { type: 'unaryOperator', op: 'percentage' }, 'function'),
  named('divide', '/', { type: 'binaryOperator', op: 'divide' }, 'operator'),
  named('sqrt', 'R', { type: 'unaryOperator', op: 'sqrt' }, 'function'),
  named('power', '^', { type: 'binaryOperator', op: 'power' }, 'function'),
  named('toggleSign', 'N', { type: 'toggleSign' }, 'function'),
  named('multiply', '*', { type: 'binaryOperator', op: 'multiply' }, 'operator'),
  digit('7'),
  digit('8'),
  digit('9'),
  named('subtract', '-', { type: 'binaryOperator', op: 'subtract' }, 'operator'),
  digit('4'),
  digit('5'),
  digit('6'),
  named('add', '+', { type: 'binaryOperator', op: 'add' }, 'operator'),
  digit('1'),
  digit('2'),
  digit('3'),
  named('equals', 'Enter', { type: 'equals' }, 'equals', 'key--tall'),
  digit('0', 'key--wide'),
  named('decimal', '.', { type: 'decimal' }, 'digit'),
]

interface KeypadProps {
  onPress: (action: CalculatorAction) => void
}

export function Keypad({ onPress }: KeypadProps) {
  return (
    <div className="keypad" role="group" aria-label={strings.calculator.keypadLabel}>
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
