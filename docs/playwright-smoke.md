# Playwright smoke suite

Run from the repository root:

```powershell
npm ci
npm --prefix frontend ci
npx playwright install chromium
npm run test:e2e
```

The suite intercepts backend API calls with deterministic fixtures. It covers
the landing page, login, dashboard, mentions, reports, and a manual scan that
reaches a completed crawl-history row. Every test fails on uncaught page
errors, `console.error`, or HTTP 5xx responses.

CI runs Chromium only with one worker and a five-minute job timeout; the target
runtime for the six-test suite is under three minutes.
