export type BinaryOperation = 'add' | 'subtract' | 'multiply' | 'divide' | 'power'
export type UnaryOperation = 'sqrt' | 'percentage'
export type Operation = BinaryOperation | UnaryOperation

export interface CalculateRequest {
  operation: Operation
  a: number
  b?: number
}

export const UNARY_OPERATIONS: readonly Operation[] = ['sqrt', 'percentage']

export const OPERATION_SYMBOLS: Record<BinaryOperation, string> = {
  add: '+',
  subtract: '−',
  multiply: '×',
  divide: '÷',
  power: '^',
}
