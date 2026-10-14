const SIGNIFICANT_DIGITS = 12

/**
 * Formats a numeric result for the display.
 *
 * Rounding to 12 significant digits hides binary floating-point noise
 * (0.1 + 0.2 shows as 0.3). The output always parses back to the rounded
 * value, so the display can safely be reused as the next operand.
 */
export function formatNumber(value: number): string {
  const rounded = Number(value.toPrecision(SIGNIFICANT_DIGITS))
  if (rounded === 0) return '0' // also normalizes -0

  const magnitude = Math.abs(rounded)
  if (magnitude >= 1e15 || magnitude < 1e-6) {
    return rounded.toExponential()
  }
  return String(rounded)
}
