# Playwright smoke suite

Run from the repository root:

```powershell
npm ci
npm --prefix frontend ci
npx playwright install chromium
npm run test:e2e
```

Authenticated routes use a Playwright `storageState` fixture. The suite uses a
strict, allowlisted local API contract fixture: unexpected API calls fail the
test instead of receiving a catch-all response. This is the deterministic local
equivalent of running the backend: it validates frontend request methods,
paths, response handling, and the manual scan's pending-to-running-to-completed
polling contract without credentials, external providers, or nondeterministic
crawler traffic.

CI runs Chromium only with one worker. `npm run test:e2e:ci` measures the full
Playwright command and fails at 180 seconds; the surrounding job timeout is four
minutes only to allow runner cleanup and log upload.
