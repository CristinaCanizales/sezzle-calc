import { useEffect, useReducer } from 'react'
import { ApiError, calculate } from '../api/calculatorClient'
import { getErrorMessage } from '../strings'
import { calculatorReducer, getExpression, initialState } from './calculatorReducer'
import { keyToAction } from './keyboard'

/** Connects the pure calculator reducer to the API and the physical keyboard. */
export function useCalculator() {
  const [state, dispatch] = useReducer(calculatorReducer, initialState)
  const { request } = state

  useEffect(() => {
    if (!request) return
    const controller = new AbortController()

    calculate(request, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) dispatch({ type: 'requestSucceeded', result })
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        // Text comes from strings.ts by error code so it can be localized.
        const message = getErrorMessage(err instanceof ApiError ? err.code : '')
        dispatch({ type: 'requestFailed', message })
      })

    return () => controller.abort()
  }, [request])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const action = keyToAction(event.key)
      if (!action) return
      // Also stops Enter from activating a focused keypad button a second time.
      event.preventDefault()
      dispatch(action)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return {
    state,
    dispatch,
    expression: getExpression(state),
    loading: request !== null,
  }
}
