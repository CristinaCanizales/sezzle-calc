/**
 * All user-facing text lives here so copy changes happen in one place.
 *
 * To localize, add another object of type `Messages` (e.g. `es`) and select it
 * at startup; the type makes missing translations a compile error. A library
 * such as react-i18next can replace this once runtime language switching or
 * pluralization is needed.
 */
const en = {
  app: {
    documentTitle: 'Calculator',
    logo: 'calc',
    sezzleLogoAlt: 'Sezzle',
    title: 'Quick math, no surprises.',
    subtitle: 'A simple calculator powered by a Go API.',
  },
  shortcuts: {
    label: 'Keyboard:',
    groups: [
      { keys: ['0–9', '.', '+', '-', '*', '/', '^', '%', '(', ')'], action: '' },
      { keys: ['R'], action: '√' },
      { keys: ['Enter'], action: '=' },
      { keys: ['Backspace'], action: '' },
      { keys: ['Esc'], action: 'clear' },
    ],
  },
  calculator: {
    label: 'Calculator',
    displayLabel: 'Display',
    keypadLabel: 'Keypad',
  },
  /** Visible key text and the accessible name read by screen readers. */
  keys: {
    clear: { label: 'AC', ariaLabel: 'Clear' },
    backspace: { label: '⌫', ariaLabel: 'Backspace' },
    openParen: { label: '(', ariaLabel: 'Open parenthesis' },
    closeParen: { label: ')', ariaLabel: 'Close parenthesis' },
    percentage: { label: '%', ariaLabel: 'Percent' },
    divide: { label: '÷', ariaLabel: 'Divide' },
    sqrt: { label: '√', ariaLabel: 'Square root' },
    power: { label: 'xʸ', ariaLabel: 'Power' },
    multiply: { label: '×', ariaLabel: 'Multiply' },
    subtract: { label: '−', ariaLabel: 'Subtract' },
    add: { label: '+', ariaLabel: 'Add' },
    equals: { label: '=', ariaLabel: 'Equals' },
    decimal: { label: '.', ariaLabel: 'Decimal point' },
  },
  /**
   * Messages keyed by API error code. The UI shows these instead of the
   * server's English `message`, so errors can be translated too.
   */
  errors: {
    INVALID_EXPRESSION: 'That expression is not valid. Check it and try again.',
    DIVISION_BY_ZERO: 'Division by zero is not allowed.',
    NEGATIVE_SQUARE_ROOT: 'Cannot take the square root of a negative number.',
    RESULT_OUT_OF_RANGE: 'The result is undefined or too large to represent.',
    NETWORK_ERROR: "Can't reach the server. Please try again.",
    fallback: 'Something went wrong. Please try again.',
  },
}

export type Messages = typeof en

export const messages: Messages = en

/** Localized text for an API error code, falling back to a generic message. */
export function getErrorMessage(code: string): string {
  const byCode: Partial<Record<string, string>> = messages.errors
  return byCode[code] ?? messages.errors.fallback
}
