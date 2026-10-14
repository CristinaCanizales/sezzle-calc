import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, calculate } from '../api/calculatorClient'
import { strings } from '../strings'
import type { CalculateRequest } from '../types'
import { Calculator } from './Calculator'

vi.mock('../api/calculatorClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/calculatorClient')>()),
  calculate: vi.fn(),
}))

type KeyId = keyof typeof strings.keys

const mockedCalculate = vi.mocked(calculate)

// A stand-in for the backend so tests read as user-visible behavior.
async function fakeBackend({ operation, a, b = 0 }: CalculateRequest): Promise<number> {
  switch (operation) {
    case 'add': return a + b
    case 'subtract': return a - b
    case 'multiply': return a * b
    case 'divide':
      // The server's English message must not reach the UI; text comes from strings.ts.
      if (b === 0) throw new ApiError('DIVISION_BY_ZERO', 'server message')
      return a / b
    case 'power': return a ** b
    case 'sqrt': return Math.sqrt(a)
    case 'percentage': return a / 100
  }
}

function setup() {
  const user = userEvent.setup()
  render(<Calculator />)
  /** Clicks keys by digit or by their id in strings.keys (e.g. 'add'). */
  const press = async (...ids: (KeyId | string)[]) => {
    for (const id of ids) {
      const name = id in strings.keys ? strings.keys[id as KeyId].ariaLabel : id
      await user.click(screen.getByRole('button', { name }))
    }
  }
  const display = () => screen.getByRole('status', { name: strings.calculator.displayLabel })
  return { user, press, display }
}

beforeEach(() => {
  mockedCalculate.mockReset()
  mockedCalculate.mockImplementation(fakeBackend)
})

describe('Calculator', () => {
  it('calculates a basic expression from keypad clicks', async () => {
    const { press, display } = setup()

    await press('1', '2', 'add', '3', 'equals')

    await waitFor(() => expect(display()).toHaveTextContent('15'))
    expect(screen.getByText('12 + 3 =')).toBeInTheDocument()
    expect(mockedCalculate).toHaveBeenCalledWith({ operation: 'add', a: 12, b: 3 }, expect.any(AbortSignal))
  })

  it('chains operations left to right', async () => {
    const { press, display } = setup()

    await press('2', 'add', '3', 'multiply')
    await waitFor(() => expect(display()).toHaveTextContent('5'))
    await press('4', 'equals')

    await waitFor(() => expect(display()).toHaveTextContent('20'))
    expect(mockedCalculate).toHaveBeenCalledTimes(2)
  })

  it('applies unary operations immediately', async () => {
    const { press, display } = setup()

    await press('9', 'sqrt')

    await waitFor(() => expect(display()).toHaveTextContent('3'))
    expect(mockedCalculate).toHaveBeenCalledWith({ operation: 'sqrt', a: 9 }, expect.any(AbortSignal))
  })

  it('shows the localized message for server errors and recovers on the next number', async () => {
    const { press, display } = setup()

    await press('5', 'divide', '0', 'equals')
    await waitFor(() => expect(display()).toHaveTextContent(strings.errors.DIVISION_BY_ZERO))

    await press('4')
    expect(display()).toHaveTextContent('4')
  })

  it('shows a friendly message when the server is unreachable', async () => {
    mockedCalculate.mockRejectedValue(new ApiError('NETWORK_ERROR', strings.errors.NETWORK_ERROR))
    const { press, display } = setup()

    await press('1', 'add', '1', 'equals')

    await waitFor(() => expect(display()).toHaveTextContent(strings.errors.NETWORK_ERROR))
  })

  describe('physical keyboard', () => {
    it('supports typing an expression and pressing Enter', async () => {
      const { user, display } = setup()

      await user.keyboard('12*3{Enter}')

      await waitFor(() => expect(display()).toHaveTextContent('36'))
      expect(mockedCalculate).toHaveBeenCalledWith({ operation: 'multiply', a: 12, b: 3 }, expect.any(AbortSignal))
    })

    it('supports Backspace and Escape', async () => {
      const { user, display } = setup()

      await user.keyboard('123{Backspace}')
      expect(display()).toHaveTextContent('12')

      await user.keyboard('{Escape}')
      expect(display()).toHaveTextContent('0')
    })

    it('does not also activate a focused keypad button when pressing Enter', async () => {
      const { user, press, display } = setup()

      await press('5') // clicking leaves the "5" button focused
      await user.keyboard('{Enter}')

      expect(display()).toHaveTextContent(/^5$/)
      expect(mockedCalculate).not.toHaveBeenCalled()
    })
  })
})
