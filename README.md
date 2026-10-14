# Full-Stack Calculator

A keypad calculator with a **React + TypeScript** frontend and a **Go** REST API. It supports addition, subtraction, multiplication and division, plus exponentiation, square root and percentage.

<p>
  <img src="docs/screenshot-desktop.png" alt="Calculator on desktop" width="560" />
  <img src="docs/screenshot-mobile.png" alt="Calculator on a phone-sized screen" width="210" />
</p>

- The keypad works like a pocket calculator and also accepts input from a physical keyboard.
- Every calculation is done by the Go API, which validates requests and returns consistent JSON errors.
- The layout is responsive down to small phones, and the keys have accessible labels and keyboard shortcuts.
- Both the backend and the frontend have unit and integration tests.

---

## Quick start (Docker)

```bash
docker compose up --build
```

| URL | What |
|---|---|
| http://localhost:3000 | The app |
| http://localhost:8080/api/health | The API, also exposed directly for `curl` |

## Local development

**Prerequisites:** Go 1.22+ and Node.js 22.12+.

```bash
# Terminal 1: API on :8080
cd backend
go run ./cmd/server

# Terminal 2: frontend on :5173 (Vite proxies /api to :8080)
cd frontend
npm install
npm run dev
```

Set the `PORT` environment variable to change the API port. If you do, also set `VITE_API_PROXY_TARGET` (for example `http://localhost:9000`) when running `npm run dev`.

### Tests and checks

```bash
cd backend
go vet ./...
go test ./...

cd frontend
npm test -- --run    # Vitest + React Testing Library
npm run lint         # oxlint
npm run build        # type-check + production build
```

---

## Project structure

```
backend/
  cmd/server/main.go             HTTP server setup, timeouts, graceful shutdown
  internal/calculator/           Pure math + domain errors (no HTTP)
  internal/api/                  Routing, request validation, error mapping, middleware
frontend/src/
  api/calculatorClient.ts        Typed fetch wrapper; normalizes every failure to ApiError
  calculator/calculatorReducer.ts  Pure keypad state machine (where most frontend logic lives)
  calculator/useCalculator.ts    Connects the reducer to the API and the keyboard
  calculator/keyboard.ts         Maps keyboard keys to calculator actions
  components/                    Calculator, Display, Keypad
  utils/format.ts                Result formatting / float rounding
  strings.ts                     All user-facing text (labels, aria-labels, error messages)
docker-compose.yml               backend (distroless) + frontend (nginx, proxies /api)
```

---

## API

### `POST /api/v1/calculate`

| Field | Type | Required |
|---|---|---|
| `operation` | `add` \| `subtract` \| `multiply` \| `divide` \| `power` \| `sqrt` \| `percentage` | yes |
| `a` | number | yes |
| `b` | number | for binary operations; ignored by `sqrt` and `percentage` |

**Success: `200 OK`**

```bash
curl -s -X POST http://localhost:8080/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation":"divide","a":10,"b":4}'
```
```json
{ "result": 2.5 }
```

```bash
curl -s -X POST http://localhost:8080/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation":"sqrt","a":81}'
```
```json
{ "result": 9 }
```

**Errors** all have the same shape. Clients should branch on `code`; `message` is safe to show to users.

```bash
curl -s -X POST http://localhost:8080/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation":"divide","a":1,"b":0}'
```
```json
{ "error": { "code": "DIVISION_BY_ZERO", "message": "Division by zero is not allowed." } }
```

```bash
curl -s -X POST http://localhost:8080/api/v1/calculate \
  -H 'Content-Type: application/json' \
  -d '{"operation":"add","a":"1","b":2}'
```
```json
{ "error": { "code": "INVALID_REQUEST", "message": "Field \"a\" must be a number." } }
```

| Status | Code | When |
|---|---|---|
| 400 | `INVALID_REQUEST` | Malformed JSON, unknown fields, wrong types, missing `operation`, body over 1 KB |
| 400 | `MISSING_OPERAND` | `a` missing, or `b` missing for a binary operation |
| 400 | `UNSUPPORTED_OPERATION` | Unknown `operation` |
| 422 | `DIVISION_BY_ZERO` | `divide` with `b = 0` |
| 422 | `NEGATIVE_SQUARE_ROOT` | `sqrt` with `a < 0` |
| 422 | `RESULT_OUT_OF_RANGE` | The result is NaN or ±Infinity (e.g. `10^400`, `0^-1`, `(-8)^0.5`) |
| 404 / 405 | `NOT_FOUND` / `METHOD_NOT_ALLOWED` | Unknown route or wrong HTTP method |
| 500 | `INTERNAL_ERROR` | Unexpected panic (recovered and logged) |

### `GET /api/health`

```json
{ "status": "ok" }
```

---

## Calculator behavior

| Topic | Behavior |
|---|---|
| **Evaluation order** | Each operation runs as soon as it is complete, like a basic pocket calculator. `2 + 3 × 4 =` gives **20**, not 14. There is no operator precedence. |
| **Percentage** | `%` divides the current number by 100. Use it as a second operand, e.g. `150 × 20 % =` → `150 × 0.2` = **30**. (The iOS-style special case where `150 + 10 %` gives 165 is not implemented.) |
| **Square root** | `√` applies immediately to the number on screen. Negative input returns an error; complex numbers are not supported. |
| **Power** | `xʸ` is a binary operator: `2 xʸ 10 =` → 1024. |
| **Floating point** | The API returns full `float64` results. The display rounds to 12 significant digits, so `0.1 + 0.2` shows `0.3`. Very large or very small values switch to exponential notation. When you chain operations, the next one uses the displayed value. |
| **Input limits** | Up to 15 digits, one decimal point, no leading zeros. Because the keypad can only produce valid numbers, the frontend needs no separate input validation. |
| **Errors** | The error message replaces the display. Typing a digit or pressing `AC` starts over. |
| **Repeated `=`** | Does nothing if there is no pending operation (`=` does not repeat the last operation). |

### Keyboard shortcuts

| Key | Action |
|---|---|
| `0`–`9`, `.` or `,` | Enter number |
| `+` `-` `*` (or `x`) `/` `^` | Operators |
| `%` | Percent |
| `R` | Square root |
| `N` | Toggle sign (±) |
| `Enter` or `=` | Equals |
| `Backspace` | Delete last digit |
| `Esc` or `Delete` | Clear |

---

## Design decisions

- **One `/calculate` endpoint instead of one per operation.** Every operation has the same shape (`operation, a, b?`), so separate routes would duplicate the handler. Supporting a new operation means adding one entry to a map in `calculator.go`.
- **The server is the single source of truth for math.** The frontend does no arithmetic: even `%` and `√` go to the API, so the rules (division by zero, negative square roots, overflow) are enforced and tested in one place. The frontend only edits the number being typed (digits, `±`, backspace).
- **Domain logic is separate from transport.** `internal/calculator` is plain Go that returns sentinel errors (`ErrDivisionByZero`, …). `internal/api` maps each error to an HTTP status and error code in a single function. This keeps the math easy to test and the HTTP error contract in one place.
- **Strict request validation.** Operands are decoded as `*float64`, so a missing `b` is not mistaken for `b: 0`. Unknown fields, wrong types, trailing data and bodies over 1 KB are rejected with specific messages. A final check turns any NaN or ±Infinity result into a 422 instead of invalid JSON.
- **400 vs 422.** 400 means the request itself is malformed. 422 means the request is well-formed but the math is undefined.
- **Go standard library only.** Go 1.22's `net/http` is enough for two routes. The middleware covers panic recovery and structured request logging (`log/slog`). The server has timeouts and shuts down gracefully on SIGTERM.
- **The keypad is a pure reducer.** All key-press logic is in `calculatorReducer.ts`, which has no side effects. A key that needs a calculation sets `state.request`, and the `useCalculator` hook sends it and dispatches the result back. Almost all frontend behavior can therefore be tested without rendering or mocks. Key presses are ignored while a request is in flight, which avoids race conditions.
- **Keyboard and on-screen keys use the same actions.** `keyboard.ts` maps keys to the same reducer actions as the buttons. `preventDefault` stops `Enter` from also clicking whichever button has focus.
- **All user-facing text is in `strings.ts`.** Labels, accessible names, keyboard hints and error messages live in one typed object, so copy changes are made in one place and a translation is just another object of the same `Strings` type (a missing key is a compile error). The UI picks error text by the API's `code` rather than showing the server's English `message`, so errors can be translated too. A library such as react-i18next would only be worth adding once the app needs runtime language switching or plural rules.
- **No CORS setup.** The browser always calls `/api/...` on its own origin. Vite's dev proxy forwards it in development, and nginx forwards it in Docker.
- **Minimal dependencies.** No UI kit, state library or CSS framework: plain CSS with custom properties covers this UI. The Docker images are a distroless static Go image (non-root, about 10 MB) and nginx serving the built frontend.

## Testing approach

Tests focus on behavior and edge cases rather than coverage numbers.

- **Backend:**
  - `calculator_test.go`: table-driven tests of every operation, plus division by zero, negative square roots, overflow, `0^-1`, fractional powers of negatives and `-0` normalization.
  - `handler_test.go`: `httptest` tests of the full HTTP contract: status codes, error codes, the shared error shape, strict decoding, the `Allow` header and panic recovery.
- **Frontend (Vitest + React Testing Library):**
  - `calculatorReducer.test.ts`: the keypad state machine (number entry, chaining, replacing an operator, percentage, recovering from an error).
  - `Calculator.test.tsx`: integration tests that render the real components with only the API client mocked. They click through flows, check server and network errors, and test keyboard input, including the focused-button-plus-Enter case.
  - Smaller unit tests for the API client, the number formatter and the key mapping.
- **Not included:** snapshot tests, styling tests, and browser end-to-end tests (see below).

## Trade-offs and future work

- **`float64` instead of decimal arithmetic.** This is fine for a general-purpose calculator, and display rounding hides binary floating-point noise. A finance-grade calculator would use a decimal library (e.g. `shopspring/decimal`) and send numbers as strings.
- **One request per operation.** Each operation is a network round trip. This is acceptable on a local network, but it is the cost of keeping all math on the server.
- **Possible next steps:**
  - Playwright end-to-end tests against the Docker stack
  - CI (GitHub Actions) running both test suites
  - An OpenAPI spec
  - Calculation history
  - Rate limiting if the API were public
