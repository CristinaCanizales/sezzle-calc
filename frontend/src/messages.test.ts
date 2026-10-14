import { describe, expect, it } from 'vitest'
import { getErrorMessage, messages } from './messages'

describe('getErrorMessage', () => {
  it('returns the message for a known API error code', () => {
    expect(getErrorMessage('DIVISION_BY_ZERO')).toBe(messages.errors.DIVISION_BY_ZERO)
  })

  it('falls back to a generic message for unknown codes', () => {
    expect(getErrorMessage('SOMETHING_NEW')).toBe(messages.errors.fallback)
    expect(getErrorMessage('')).toBe(messages.errors.fallback)
  })
})
