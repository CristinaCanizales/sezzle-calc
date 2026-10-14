import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, evaluate } from '../api/calculatorClient'
import { messages } from '../messages'
import { Calculator } from './Calculator'

vi.mock('../api/calculatorClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/calculatorClient')>()),
  evaluate: vi.fn(),
}))

type KeyId = keyof typeof messages.keys

const mockedEvaluate = vi.mocked(evaluate)

// Canned server answers keyed by the exact expression the UI sends.
const SERVER_RESULTS: Record<string, number> = {
  '2 + 3 * 4': 14,
  '( 2 + 3 ) * 4': 20,
  'sqrt 9 + 1': 4,
  '14 * 2': 28,
  '12 * 3': 36,
  '5 / 2': 2.5,
  '50 + 10 %': 55,
}

async function fakeBackend(expression: string): Promise<number> {
  // The server's English message must not reach the UI; text comes from messages.ts.
  if (expression === '5 / 0') throw new ApiError('DIVISION_BY_ZERO', 'server message')
  if (expression in SERVER_RESULTS) return SERVER_RESULTS[expression]
  throw new Error(`Unexpected expression in test: "${expression}"`)
}

function setup() {
  const user = userEvent.setup()
  render(<Calculator />)
  /** Clicks keys by digit or by their id in messages.keys (e.g. 'add'). */
  const press = async (...ids: (KeyId | string)[]) => {
    for (const id of ids) {
      const name = id in messages.keys ? messages.keys[id as KeyId].ariaLabel : id
      await user.click(screen.getByRole('button', { name }))
    }
  }
  const display = () => screen.getByRole('status', { name: messages.calculator.displayLabel })
  return { user, press, display }
}

beforeEach(() => {
  mockedEvaluate.mockReset()
  mockedEvaluate.mockImplementation(fakeBackend)
})

describe('Calculator', () => {
  it('evaluates with operator precedence', async () => {
    const { press, display } = setup()

    await press('2', 'add', '3', 'multiply', '4')
    expect(display()).toHaveTextContent('2 + 3 × 4')
    await press('equals')

    await waitFor(() => expect(display()).toHaveTextContent(/^14$/))
    expect(screen.getByText('2 + 3 × 4 =')).toBeInTheDocument()
    expect(mockedEvaluate).toHaveBeenCalledOnce()
    expect(mockedEvaluate).toHaveBeenCalledWith('2 + 3 * 4', expect.any(AbortSignal))
  })

  it('supports parentheses', async () => {
    const { press, display } = setup()

    await press('openParen', '2', 'add', '3', 'closeParen', 'multiply', '4', 'equals')

    await waitFor(() => expect(display()).toHaveTextContent(/^20$/))
  })

  it('supports square root in an expression', async () => {
    const { press, display } = setup()

    await press('sqrt', '9', 'add', '1')
    expect(display()).toHaveTextContent('√9 + 1')
    await press('equals')

    await waitFor(() => expect(display()).toHaveTextContent(/^4$/))
  })

  it('adds a percentage of the left side, like iOS (50 + 10% = 55)', async () => {
    const { press, display } = setup()

    await press('5', '0', 'add', '1', '0', 'percentage', 'equals')

    await waitFor(() => expect(display()).toHaveTextContent(/^55$/))
    expect(screen.getByText('50 + 10% =')).toBeInTheDocument()
  })

  it('continues from a result', async () => {
    const { press, display } = setup()

    await press('2', 'add', '3', 'multiply', '4', 'equals')
    await waitFor(() => expect(display()).toHaveTextContent(/^14$/))
    await press('multiply', '2', 'equals')

    await waitFor(() => expect(display()).toHaveTextContent(/^28$/))
  })

  it('shows the localized error and keeps the expression for editing', async () => {
    const { press, display } = setup()

    await press('5', 'divide', '0', 'equals')
    await waitFor(() => expect(display()).toHaveTextContent(messages.errors.DIVISION_BY_ZERO))
    expect(screen.getByText('5 ÷ 0')).toBeInTheDocument()

    await press('backspace', '2', 'equals')
    await waitFor(() => expect(display()).toHaveTextContent(/^2\.5$/))
  })

  it('shows a friendly message when the server is unreachable', async () => {
    mockedEvaluate.mockRejectedValue(new ApiError('NETWORK_ERROR', messages.errors.NETWORK_ERROR))
    const { press, display } = setup()

    await press('1', 'add', '1', 'equals')

    await waitFor(() => expect(display()).toHaveTextContent(messages.errors.NETWORK_ERROR))
  })

  describe('physical keyboard', () => {
    it('supports typing an expression with parentheses and pressing Enter', async () => {
      const { user, display } = setup()

      await user.keyboard('(2+3)*4{Enter}')

      await waitFor(() => expect(display()).toHaveTextContent(/^20$/))
      expect(mockedEvaluate).toHaveBeenCalledWith('( 2 + 3 ) * 4', expect.any(AbortSignal))
    })

    it('supports Backspace and Escape', async () => {
      const { user, display } = setup()

      await user.keyboard('123{Backspace}')
      expect(display()).toHaveTextContent(/^12$/)

      await user.keyboard('{Escape}')
      expect(display()).toHaveTextContent(/^0$/)
    })

    it('does not also activate a focused keypad button when pressing Enter', async () => {
      const { user, press, display } = setup()

      await press('5') // clicking leaves the "5" button focused
      await user.keyboard('{Enter}')

      expect(display()).toHaveTextContent(/^5$/)
      expect(mockedEvaluate).not.toHaveBeenCalled()
    })
  })
})
