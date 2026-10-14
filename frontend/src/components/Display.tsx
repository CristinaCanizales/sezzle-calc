import { strings } from '../strings'

interface DisplayProps {
  expression: string
  value: string
  error: string | null
  loading: boolean
}

function sizeClass(text: string): string {
  if (text.length > 22) return 'display__value--xsmall'
  if (text.length > 13) return 'display__value--small'
  if (text.length > 9) return 'display__value--medium'
  return ''
}

export function Display({ expression, value, error, loading }: DisplayProps) {
  return (
    <div className="display" aria-busy={loading}>
      <div className="display__expression" aria-hidden={!expression}>
        {expression || ' '}
      </div>
      <output
        className={`display__value ${error ? 'display__value--error' : sizeClass(value)}`}
        aria-live="polite"
        aria-label={strings.calculator.displayLabel}
      >
        {error ?? value}
      </output>
    </div>
  )
}
