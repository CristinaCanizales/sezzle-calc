import { afterEach, describe, expect, it, vi } from 'vitest'
import { strings } from '../strings'
import { ApiError, calculate } from './calculatorClient'

function mockFetch(impl: () => Promise<Response>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(impl)
}

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('calculate', () => {
  it('posts the request and returns the result', async () => {
    const fetchSpy = mockFetch(() => jsonResponse(200, { result: 5 }))

    await expect(calculate({ operation: 'add', a: 2, b: 3 })).resolves.toBe(5)

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/v1/calculate')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({ operation: 'add', a: 2, b: 3 })
  })

  it('throws an ApiError with the server code and message', async () => {
    mockFetch(() =>
      jsonResponse(422, {
        error: { code: 'DIVISION_BY_ZERO', message: 'Division by zero is not allowed.' },
      }),
    )

    const error = await calculate({ operation: 'divide', a: 1, b: 0 }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'DIVISION_BY_ZERO', message: 'Division by zero is not allowed.' })
  })

  it('reports network failures with a friendly message', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')))

    await expect(calculate({ operation: 'sqrt', a: 4 })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: strings.errors.NETWORK_ERROR,
    })
  })

  it('handles responses that are not in the expected shape', async () => {
    mockFetch(() => Promise.resolve(new Response('<html>Bad Gateway</html>', { status: 502 })))

    await expect(calculate({ operation: 'add', a: 1, b: 1 })).rejects.toMatchObject({
      code: 'UNEXPECTED_RESPONSE',
    })
  })
})
