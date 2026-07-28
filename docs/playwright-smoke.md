# Playwright smoke suite

Run from the repository root:

```powershell
npm ci
npm --prefix frontend ci
npx playwright install chromium
npm run test:e2e
```

Authenticated routes use a Playwright `storageState` fixture. General route
data uses a strict API allowlist; unexpected API calls fail instead of receiving
a catch-all response. The manual scan is not mocked: Playwright starts a real
local FastAPI server, the production crawl router and scan service, a temporary
SQLite database, and a deterministic local RSS source. The browser POSTs to
FastAPI and polls the real crawl-job table through running to completed.
The fixture constrains the production scan service to its RSS adapter so no
external search/social providers can affect the result.
It also fills the scan service's legacy `query` metadata from the submitted
`keywords` array; this is test-harness normalization for an optional field, not
a mocked scan response.

CI runs Chromium only with one worker. `npm run test:e2e:ci` measures the full
Playwright command and fails at 180 seconds. The surrounding eight-minute job
timeout also covers Python/Node/browser installation and runner cleanup; it does
not weaken the measured test-runtime gate.
