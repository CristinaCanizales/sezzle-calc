export type Operator = '+' | '-' | '*' | '/' | '^'

/** Display symbols for the ASCII operators sent to the API. */
export const OPERATOR_SYMBOLS: Record<Operator, string> = {
  '+': '+',
  '-': '−',
  '*': '×',
  '/': '÷',
  '^': '^',
}
