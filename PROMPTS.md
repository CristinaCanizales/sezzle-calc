# Prompts

This project was built with Claude Code, an AI coding assistant. These are the prompts I used, in order and copied verbatim. A short note after each one says what it led to.

---

## 1. Planning

> I need to build a full stack calculator for a take-home assignment as part of my interview process for Software Engineer II at Sezzle. I want to keep the implementation simple, clean, and well-tested, since I have around 2–3 hours to complete it.
>
> The stack should be React with TypeScript for the frontend and Go for the backend. The frontend should communicate with the backend through a REST API.
>
> The calculator should support 4 basic operations: addition, subtraction, multiplication and division, and 3 optional: exponentiation, square root, and percentage calculations. It should have a simple, intuitive and responsive UI (basic mobile support), validate inputs, display results and handle errors gracefully. I'd like the styling and look and feel to be similar to Sezzle's website (https://sezzle.com); I see purple as the main colour. The backend should validate requests, handle edge cases like division by zero, and return consistent JSON responses.
>
> I also need unit tests for both the frontend and backend, plus a README with setup instructions, API examples, and explanations of the main design decisions. Docker support is would be ideal so reviewers can run the project easily.
>
> Before implementing anything, help me come up with a plan.
>
> Please:
> - Propose a reasonable project structure for the frontend and backend.
> - Recommend an API design and explain how the frontend and backend should interact.
> - Identify any assumptions we need to make about calculator behavior, especially percentages, square roots, and floating-point precision.
> - Suggest an approach to input validation and error handling.
> - Outline the main frontend components and backend responsibilities.
> - Define a testing strategy that covers the important functionality without spending too much time on low-value tests.
> - Break the implementation into small, ordered steps, with estimated time for each, keeping the total within the 2–3 hour limit.
> - Include the README and final verification in the plan.
> - Make sure we include Documentation: setup instructions, API usage, and design rationale
> - Point out any potential overengineering and suggest where we should prioritize our time.
>
> We'll be starting from an empty folder, so include the initial project setup and dependency installation in the plan.
>
> Make pragmatic decisions rather than giving me too many alternatives. It's a simple calculator so we want something that demonstrates good engineering judgment without being unnecessarily complex.
>
> For now, only return the plan. Don't create or modify any files until I review and approve it.

*Result:* a plan only, with no code yet. It proposed a single `POST /api/v1/calculate` endpoint, a Go standard-library backend with a separate calculator package, and a form-based UI (two number fields plus operation buttons). It also covered the percentage and floating-point assumptions, a testing strategy and a timed step-by-step schedule.

## 2. Keypad UI

> I'd prefer a keypad calculator, it's more familiar to the user when thinking on a calculator

*Result:* a revised plan with a pocket-calculator keypad. Each operation would be sent to the API as soon as it was complete, and all key logic would live in a pure state reducer.

## 3. Approval, with keyboard support

> yes, let's go ahead with the plan. Just one extra thing, I do want physical keeyboard support to be included as part of the main work, it's better for usability

When asked about setup, I chose to install Go with winget, and to write the Docker files without installing Docker on my machine.

*Result:*
- **Backend:** the Go API with tests.
- **Frontend:** the React keypad with physical keyboard support and a Sezzle-inspired design, with unit and integration tests.
- **Docker:** Dockerfiles and `docker-compose.yml`.
- **Documentation:** the README.

## 4. User-facing text in one file

> I'd like all text to belong to a constants.ts file or similar so then if any text needs to be modified, it's easier to find. I'm also thinking on later localization needs, etc

*Result:* all user-facing text moved into one typed file. Error messages are now chosen by the API's error code instead of showing the server's English text, so they can be translated.

*Manual change:* I added the Sezzle logo to the header myself.

## 5. Expressions and operator precedence

> since it's all working now and there's time left, can we work on improving the behavior? instead of just a basic calculator, let's include expressions or at least operator precedence, that way 2 +3 x 4 correctly results to 14 and not 20, for example

*Result:*
- **Backend:** a new `POST /api/v1/evaluate` endpoint with a recursive-descent parser in Go. It supports precedence, parentheses, `^`, `√`, `%` and negative numbers.
- **Frontend:** the keypad now builds whole expressions, with `(` and `)` keys, and `−` doubles as the minus sign.

## 6. iOS-style percentages (asked in a separate chat)

> Let's use iOS behavior for percentage, so 50 + 10% is actually 55

*Result:* the parser now treats `a + b%` and `a − b%` as `b` percent of `a`.

## 7. Making the percentage change consistent everywhere

> I asked "Let's use iOS behavior for percentage, so 50 + 10% is actually 55" in another chat to update percentage behavior. Let's make sure all documentation, api examples and tests reflects that. Also, let's update screenshots

*Result:* tests at every level (parser, HTTP and UI), README examples and design notes for the new rule, and new screenshots.

## 8. Commit the logo and rename the text file

> we can include that as well, that was an intentional change. Though I'd like strings to be renamed to something more representative

*Result:* `strings.ts` was renamed to `messages.ts`, the usual term in i18n libraries, and committed together with the logo and the new screenshots.
