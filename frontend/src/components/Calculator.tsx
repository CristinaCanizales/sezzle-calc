import { useCalculator } from '../calculator/useCalculator'
import { Display } from './Display'
import { Keypad } from './Keypad'

export function Calculator() {
  const { state, dispatch, expression, loading } = useCalculator()

  return (
    <section className="calculator" aria-label="Calculator">
      <Display expression={expression} value={state.display} error={state.error} loading={loading} />
      <Keypad onPress={dispatch} />
    </section>
  )
}
