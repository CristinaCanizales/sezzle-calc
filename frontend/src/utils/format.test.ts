import { describe, expect, it } from 'vitest'
import { formatNumber } from './format'

describe('formatNumber', () => {
  it.each([
    [5, '5'],
    [-2.5, '-2.5'],
    [0.1 + 0.2, '0.3'],
    [1 / 3, '0.333333333333'],
    [-0, '0'],
    [123456789012, '123456789012'],
    [1e21, '1e+21'],
    [1.234567890123e18, '1.23456789012e+18'],
    [0.0000001234, '1.234e-7'],
    [0.000123, '0.000123'],
  ])('formats %d as %s', (value, expected) => {
    expect(formatNumber(value)).toBe(expected)
  })

  it('produces output that parses back to the rounded value', () => {
    const formatted = formatNumber(2 / 3)
    expect(Number(formatted)).toBe(Number((2 / 3).toPrecision(12)))
  })
})
