import type { CalculatorAction } from '../calculator/calculatorReducer'

type KeyVariant = 'digit' | 'function' | 'operator' | 'equals'

interface KeyConfig {
  label: string
  ariaLabel?: string
  shortcut: string
  action: CalculatorAction
  variant: KeyVariant
  className?: string
}

const digit = (d: string): KeyConfig => ({
  label: d,
  shortcut: d,
  action: { type: 'digit', digit: d },
  variant: 'digit',
})

// Order matters: CSS grid auto-placement lays these out in a 4-column grid.
const KEYS: KeyConfig[] = [
  { label: 'AC', ariaLabel: 'Clear', shortcut: 'Escape', action: { type: 'clear' }, variant: 'function' },
  { label: '⌫', ariaLabel: 'Backspace', shortcut: 'Backspace', action: { type: 'backspace' }, variant: 'function' },
  { label: '%', ariaLabel: 'Percent', shortcut: '%', action: { type: 'unaryOperator', op: 'percentage' }, variant: 'function' },
  { label: '÷', ariaLabel: 'Divide', shortcut: '/', action: { type: 'binaryOperator', op: 'divide' }, variant: 'operator' },
  { label: '√', ariaLabel: 'Square root', shortcut: 'R', action: { type: 'unaryOperator', op: 'sqrt' }, variant: 'function' },
  { label: 'xʸ', ariaLabel: 'Power', shortcut: '^', action: { type: 'binaryOperator', op: 'power' }, variant: 'function' },
  { label: '±', ariaLabel: 'Toggle sign', shortcut: 'N', action: { type: 'toggleSign' }, variant: 'function' },
  { label: '×', ariaLabel: 'Multiply', shortcut: '*', action: { type: 'binaryOperator', op: 'multiply' }, variant: 'operator' },
  digit('7'),
  digit('8'),
  digit('9'),
  { label: '−', ariaLabel: 'Subtract', shortcut: '-', action: { type: 'binaryOperator', op: 'subtract' }, variant: 'operator' },
  digit('4'),
  digit('5'),
  digit('6'),
  { label: '+', ariaLabel: 'Add', shortcut: '+', action: { type: 'binaryOperator', op: 'add' }, variant: 'operator' },
  digit('1'),
  digit('2'),
  digit('3'),
  { label: '=', ariaLabel: 'Equals', shortcut: 'Enter', action: { type: 'equals' }, variant: 'equals', className: 'key--tall' },
  { ...digit('0'), className: 'key--wide' },
  { label: '.', ariaLabel: 'Decimal point', shortcut: '.', action: { type: 'decimal' }, variant: 'digit' },
]

interface KeypadProps {
  onPress: (action: CalculatorAction) => void
}

export function Keypad({ onPress }: KeypadProps) {
  return (
    <div className="keypad" role="group" aria-label="Keypad">
      {KEYS.map((key) => (
        <button
          key={key.label}
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
