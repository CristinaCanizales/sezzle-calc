import { strings } from '../strings'

const EVALUATE_URL = '/api/v1/evaluate'

/** Every failure from the client is normalized to this type so the UI has one case to handle. */
export class ApiError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

interface ErrorBody {
  error: { code: string; message: string }
}

function isErrorBody(body: unknown): body is ErrorBody {
  const error = (body as ErrorBody | null)?.error
  return typeof error?.code === 'string' && typeof error?.message === 'string'
}

/** Evaluates an arithmetic expression such as "2 + 3 * 4" on the server. */
export async function evaluate(expression: string, signal?: AbortSignal): Promise<number> {
  let response: Response
  try {
    response = await fetch(EVALUATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expression }),
      signal,
    })
  } catch (err) {
    if (signal?.aborted) throw err
    throw new ApiError('NETWORK_ERROR', strings.errors.NETWORK_ERROR)
  }

  const body: unknown = await response.json().catch(() => null)

  if (response.ok && typeof (body as { result?: unknown } | null)?.result === 'number') {
    return (body as { result: number }).result
  }
  if (isErrorBody(body)) {
    throw new ApiError(body.error.code, body.error.message)
  }
  throw new ApiError('UNEXPECTED_RESPONSE', strings.errors.fallback)
}
