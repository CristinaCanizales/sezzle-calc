import { useCalculator } from '../calculator/useCalculator'
import { strings } from '../strings'
import { Display } from './Display'
import { Keypad } from './Keypad'

export function Calculator() {
  const { state, dispatch, display, expression, loading } = useCalculator()

  return (
    <section className="calculator" aria-label={strings.calculator.label}>
      <Display expression={expression} value={display} error={state.error} loading={loading} />
      <Keypad onPress={dispatch} />
    </section>
  )
}
