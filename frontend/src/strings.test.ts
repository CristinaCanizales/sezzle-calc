import { describe, expect, it } from 'vitest'
import { getErrorMessage, strings } from './strings'

describe('getErrorMessage', () => {
  it('returns the message for a known API error code', () => {
    expect(getErrorMessage('DIVISION_BY_ZERO')).toBe(strings.errors.DIVISION_BY_ZERO)
  })

  it('falls back to a generic message for unknown codes', () => {
    expect(getErrorMessage('SOMETHING_NEW')).toBe(strings.errors.fallback)
    expect(getErrorMessage('')).toBe(strings.errors.fallback)
  })
})
