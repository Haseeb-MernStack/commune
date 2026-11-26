# Testing

How to run every kind of test in commune, and what each CI check does.

## Before you start

```bash
npm install
```

Node.js 22+ is required (see `.nvmrc`). The API and end-to-end tests need
MongoDB:

```bash
docker compose up -d mongo
```

The unit tests do not need a database.

## Unit and component tests

The API and realtime tests run with Vitest, and the web app has Vitest
component tests too.

Run everything from the repository root:

```bash
npm test
```

Note: `npm test` runs the API and realtime tests only. Run the web tests
separately from `apps/web`:

```bash
cd apps/web
npx vitest run
```

Run a single test file. From the repository root:

```bash
npm run test -w @commune/api -- src/routes/auth.test.ts
```

From `apps/web`:

```bash
npx vitest run src/lib/time.test.ts
```

Watch mode (re-runs on save) works from any workspace that uses Vitest:

```bash
npx vitest
```

## API coverage

The API tests report coverage with `@vitest/coverage-v8`. Running the API
tests (`npm run test -w @commune/api`) prints a coverage summary in the log
and writes an HTML report to `apps/api/coverage/index.html` (open it in a
browser). CI uploads that report as the `api-coverage` artifact, kept for
7 days.

The floor is 40% for lines, functions, branches and statements, set in
`apps/api/vitest.config.ts`. It is a starting floor: it sits below the
coverage the suite has today so it protects the level without blocking work.
Raise it when coverage grows.

### Raising the floor

1. Run the API tests and read the summary (or open
   `apps/api/coverage/index.html`).
2. Pick a number slightly under the measured coverage, for the metric that
   moved.
3. Update the `thresholds` in `apps/api/vitest.config.ts` and note the new
   number here.
4. A pull request that lowers coverage below the floor fails CI, so a lower
   number here means the suite got thinner, not that the floor moved.

## End-to-end tests

Playwright drives a real browser against the real API and a separate
`commune_e2e` database. The tests live in `e2e/`. See
[docs/DEVELOPMENT.md](DEVELOPMENT.md) for setup.

```bash
docker compose up -d mongo   # the tests need MongoDB
npx playwright install chromium   # once
npm run e2e                    # or: npx playwright test
npx playwright test --ui       # watch it step by step
```

Keep end-to-end tests few and stable: one test that proves a visitor can
join, post, sign out and sign back in.

## CI checks

CI runs on every push to `main` and every pull request.

| Check | Workflow | What it does | Reproduce locally |
| --- | --- | --- | --- |
| Typecheck | `.github/workflows/ci.yml` | `npm run typecheck` — TypeScript check for shared, api, web and realtime | `npm run typecheck` |
| Tests | `.github/workflows/ci.yml` | `npm test` — API and realtime Vitest suites | `npm test` |
| Build | `.github/workflows/ci.yml` | `npm run build` — production build of api, web and realtime | `npm run build` |
| Lint | `.github/workflows/quality.yml` | `npm run lint` — ESLint, blocks merging | `npm run lint` |
| Format | `.github/workflows/quality.yml` | `npm run format:check` — Prettier check, reports only for now | `npm run format:check` |
| Browser tests | `.github/workflows/e2e.yml` | `npx playwright test` against MongoDB and Chromium, reports only for now | `npm run e2e` |
| Security | `.github/workflows/codeql.yml`, `.github/workflows/scorecard.yml` | CodeQL and OpenSSF Scorecard scans | — |

Fix formatting with `npm run format` before opening a pull request.

## My test fails only in CI

- Run the exact command CI runs (see the table above) instead of a
  workspace shortcut. `npm test` from the root only covers the API and
  realtime suites; the web tests need `npx vitest run` from `apps/web`.
- Make sure MongoDB is running for the API and end-to-end tests:
  `docker compose up -d mongo`. The API unit tests mock the models and
  need no database.
- Use Node.js 22, the version CI uses. Check with `node --version`.
- For browser tests, download the CI report: the end-to-end workflow uploads
  the Playwright report and test results (screenshots and a trace) when a
  run fails.
