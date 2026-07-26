# Login warning, vi/en localization, and real source coverage

Branch: `fix/login-localization-source-coverage`
Commits: `828a0fd` (first pass) + `fix: finish localization and source discovery` (this pass)

One consolidated change covering:

1. investigation of the Chrome password-breach popup shown after login,
2. removal of plaintext credentials and the obsolete backend URL from the working tree,
3. restricting the product to Vietnamese + English and removing mixed-language UI,
4. localized handling of backend errors,
5. RSS/Atom hardening, correct project attribution, feed auto-discovery and OPML import,
6. SSRF and DNS-rebinding protections.

> **Verification status for this pass.** Local tests, type-check, lint, build and
> runtime/browser verification were **not run** for the final state of this branch,
> by explicit user instruction. This document therefore makes **no claim** that the
> final code passes any check. Everything below describes what the code is written
> to do, plus static (read-only) review of the diff. See
> [Verification status](#verification-status) for the exact position.

---

## 1. Chrome password warning after login

### Conclusion

The popup is **browser-owned UI, not a Nope360 modal**. Chrome / Google Password
Manager compares the password you just submitted against its breach corpus and
shows "Check your saved passwords — the password you just used was found in a data
breach". No application code can, or should, suppress it, and nothing in this
change tries to. **The user must change the compromised/reused password** — that is
the only action that clears the warning.

No fake replacement toast was added, no browser feature was disabled, and no
JavaScript was introduced to interfere with Chrome Password Manager. A static check
of the login page confirms the application renders no dialog of its own there and
contains no `navigator.credentials` / password-manager suppression code.

### Application-side defects found and fixed

| Finding | Location | Fix |
| --- | --- | --- |
| Hardcoded weak admin password, printed to stdout on creation | `backend/app/scripts/create_admin.py` | Credentials read from `ADMIN_EMAIL` / `ADMIN_PASSWORD`, minimum 12 characters, refuses to run when unset or too short, never prints the value |
| Same script could not run at all — imported `AsyncSessionLocal`, which does not exist in `app/core/database.py` | `backend/app/scripts/create_admin.py` | Rewritten against the real synchronous `SessionLocal`; credential validation runs before any DB import so a misconfigured run fails fast |
| Registration accepted any non-empty password while `/me/change-password` required 8 characters | `backend/app/api/auth.py` | `UserCreate.password` now has `min_length=8`, matching the change-password rule |
| Login email placeholder was `admin@example.com`, nudging users toward a shared admin account | `frontend/src/app/login/page.tsx` | Neutral placeholder, localized |
| Register form enforced only 6 characters and gave no password guidance | `frontend/src/app/register/page.tsx` | Minimum raised to 8 with `minLength`, plus a hint telling the user not to reuse a password from another service |
| Hardcoded fallback alert recipient address | `backend/app/services/notification_service.py` | Recipient comes from configuration only (`EmailSettings.from_email` → `SMTP_FROM` → `ADMIN_SEED_EMAIL`); when nothing is configured the send is skipped and logged instead of mailing an address nobody owns |

Autocomplete attributes were corrected to the standard pattern:

- login: `autocomplete="username"` on email (was `email`), `autocomplete="current-password"` on password
- register: `autocomplete="username"` on email, `autocomplete="new-password"` on both password fields, `autocomplete="name"` on full name
- register password fields use distinct `name` values (`new-password`, `confirm-new-password`) so the browser does not treat the form as a login form and offer the wrong saved credential

Checked and found clean: no credential in `localStorage`/`sessionStorage` (only
`access_token`, `refresh_token`, `cached_user`, `permissions`,
`selected_project_id`); no password rendered into HTML, logged to console or sent to
error tracking (the register page's `console.error` no longer includes the request
body); no third-party authentication script on the login page; both password inputs
are `type="password"`.

### ⚠ Credential rotation you must perform yourself

Removing values from the working tree does **not** un-leak them: they remain in Git
history. **Git history was deliberately not rewritten** — rewriting it would require
a force-push, break every existing clone and checkout, invalidate open PRs, and it
still cannot recall data already fetched by anyone. Rotation at the identity
provider is the only effective remedy.

Rotate these before doing anything else:

1. **Every application account password** that appeared in the root `scripts/*.py`
   utilities (admin and non-admin), including any password you reuse elsewhere.
2. **The PostgreSQL credentials** that were embedded in `check_db.py` as a full
   connection string. That string granted direct database access; treat it as
   compromised and rotate the database user's password in your hosting provider.

After rotating, set the new values as environment variables (see
[Configuration](#configuration-requirements)) — never back into a file.

---

## 2. Credential and obsolete-URL cleanup

### What was removed from the working tree

A deterministic migration replaced every hardcoded credential and the retired
backend URL across the tracked developer/ops scripts. The migration never printed a
value; findings were reported as ranked opaque identifiers only.

| Category | Before | After |
| --- | --- | --- |
| Password literals | 32 occurrences | 0 |
| Account email literals | 38 occurrences | 0 |
| Obsolete backend URL in executable code | 25 occurrences | 0 |
| Obsolete backend URL in docs | 9 files | 0 |
| Database connection string with inline credentials | 1 (`check_db.py`) | 0 |
| Hardcoded fallback recipient email | 2 (`notification_service.py`) | 0 |

A verification pass extracted the 11 distinct credential values from the `HEAD`
versions of the migrated files and searched the entire tracked tree for them:
**0 files still contain any of them.**

### How the scripts get their configuration now

`scripts/_env_config.py` is the single, safe entry point:

```
NOPE360_BACKEND_URL       backend base URL (default https://sociallistening-9fvs.onrender.com)
NOPE360_ADMIN_EMAIL       primary admin account email
NOPE360_ADMIN_PASSWORD    primary admin account password
NOPE360_USER_EMAIL        secondary (non-admin) account            [optional]
NOPE360_USER_PASSWORD
NOPE360_ALT_EMAIL         third account                            [optional]
NOPE360_ALT_PASSWORD
NOPE360_ACCOUNT4..7_*     one-off accounts used by single scripts  [optional]
```

The helper refuses to run when a required variable is missing, prints a clear
value-free error, and **rejects the retired backend host outright** if someone puts
it back into `NOPE360_BACKEND_URL`. `login()` raises a value-free error on
authentication failure so a wrong password never lands in a traceback.

`check_db.py` was rewritten to take `NOPE360_DB_URL` (or `DATABASE_URL`),
`NOPE360_TARGET_EMAIL` and an optional `NOPE360_NEW_PASSWORD` (min 12 chars). It
prints only `id`/`email`/`is_active` and a success flag, and on failure prints the
exception **type** only, because a psycopg2 message can echo the DSN.

Local-development PostgreSQL DSNs in `RUN.bat`, `SETUP.md`, `backend/.env.example`,
`backend/app/core/config.py` and `docs/DEPLOYMENT.md` were normalised to the
conventional `postgres:postgres@localhost` placeholder. These only ever pointed at
`localhost`, so they could not expose a remote system, but they no longer carry a
personal value.

`.env.example` (new, repository root) documents every variable with placeholders
only. No real `.env` file was created or modified.

### Enforcement against reintroduction

`backend/tests/test_repo_secret_hygiene.py` is a repository-wide static guard. It
is deliberately **pattern-based** — it contains no credential value of its own — and
fails when:

- the retired backend host appears in executable code, or in docs
- a password identifier is bound to a string literal outside an allowlisted
  fixture file
- an account-email constant appears outside an allowlisted fixture file
- a connection string carries inline credentials for a non-local host
- `scripts/_env_config.py` stops documenting the expected variables, or stops
  defaulting to the current backend URL
- `.env.example` loses a variable, or gains a usable value

The allowlist names each file and the reason. Offenders are reported as
`path:line (category, N chars)` — never as values.

---

## 3. Vietnamese + English only

### Policy

- Supported: `vi` (default) and `en`.
- Retired: `th`, `ja`, `ko`, `zh`. Not selectable, not loaded, not valid as a
  persisted preference. Their locale files were **deleted** — they were reachable
  only through `src/i18n/index.ts`, and each was missing 105 keys relative to `vi`.

### Locale resolution

`resolveLanguage()` in `frontend/src/i18n/index.ts` is the single normalisation point:

| Stored / detected value | Resolves to |
| --- | --- |
| `vi`, `vi-VN`, `Vi-Vn`, `  vi  ` | `vi` |
| `en`, `en-US`, `en_GB`, `EN` | `en` |
| `th`, `ja`, `ko`, `zh`, `zh-CN`, `ja-JP` | `vi` (default) |
| `fr`, empty, `null`, `undefined`, a number, an object | `vi` (default) |

`LanguageContext` reads `localStorage.app_language` on mount and, when the stored
value is unsupported, **rewrites it** to the resolved language rather than silently
ignoring it — the old behaviour left the switcher and the rendered text disagreeing.
With nothing stored, `detectBrowserLanguage()` picks the first supported entry from
`navigator.languages`. `document.documentElement.lang` tracks the active language.

`t()` gained `{placeholder}` interpolation (`t('key', { count: 5 })`) so a sentence
stays one translatable unit instead of being concatenated in JSX, and it returns the
key path instead of `[object Object]` when a key resolves to an object.

### Scale of the migration

| Metric | Before | After |
| --- | --- | --- |
| Translation keys (per language) | 485 | **2,156** |
| vi/en key parity | full | full |
| Active retired locales | 4 | **0** |
| Hardcoded application-owned visible strings | **1,428** in 76 files | **0** |
| Allowlisted literals | — | 77 values + 5 path prefixes |

The bulk migration was executed across 14 parallel workers, one batch of files each;
each worker rewrote only its own components and emitted a key file, which a
deterministic AST-guided merge (`frontend/scripts/merge-i18n-keys.mjs`) folded into
`vi.ts` and `en.ts`. That avoided concurrent edits to the shared dictionaries.

Additionally, 25 dictionary entries whose *Vietnamese* value was actually English
were translated (`dashboard.title`, `dashboard.metrics.*`, `summary.page.aiTitle`,
`header.workerOnline|workerOffline|workerOff`, `settings.tabs.logs`, and others) —
that was the visible cause of the mixed-language complaint.

Two further leaks were found and fixed:

- `GET /api/reports/...` returned the literal `"Toàn bộ hệ thống"` as `project_name`
  when no project was selected. That is UI text, not a project name, so the backend
  now returns `null` and the frontend renders the localized
  `t('reports.allProjects')`. A real project's name is still passed through
  unchanged.
- `frontend/src/lib/permissions.ts` held hardcoded Vietnamese role names.
  `getRoleDisplayName` now takes `t` and reads `roles.*` from the dictionary.

### Enforcement

`frontend/scripts/check-i18n-keys.mjs` (`npm run check-i18n`) fails when:

- a key exists in `vi` but not `en`, **or** in `en` but not `vi`
- a retired locale file reappears, or an unknown locale file appears
- `SUPPORTED_LANGUAGES` stops being exactly `[vi, en]`, or `index.ts` imports a retired locale
- a value is empty
- a value is byte-identical across `vi` and `en` while looking like prose
  (placeholder / untranslated copy-paste detection)

`frontend/scripts/check-hardcoded-ui.mjs` (`npm run check-hardcoded`) is new. It
parses every `.ts`/`.tsx` under `src` with the TypeScript compiler and reports
user-facing literals that are not going through `t()`: JSX text, a curated set of
attributes (`placeholder`, `title`, `alt`, `aria-label`, `description`, …), and
string arguments to `toast.*` / `alert` / `confirm` / `set*Error` style setters. It
deliberately ignores technical contexts (`className`, `href`, routes, camelCase
identifiers, enum constants, colours, HTML entities).

`frontend/scripts/check-locale-behavior.mjs` (`npm run check-locales`) transpiles the
real `src/i18n` module with the TypeScript compiler already in `devDependencies` and
asserts 15 behaviours (supported set, default, loaded dictionaries, selector
options, retired-locale rejection, `resolveLanguage` mapping, `detectBrowserLanguage`
selection, dictionary shape).

### Allowlist categories

Every entry in `frontend/scripts/hardcoded-ui-allowlist.json` carries a reason:

| Category | Examples | Why |
| --- | --- | --- |
| Brand | `Nope360`, `EchoMind`, `NOPE360 INTELLIGENCE` | product names |
| Platforms / providers | `YouTube`, `Facebook`, `Instagram`, `TikTok`, `X / Twitter`, `Reddit`, `Web Search`, `Meta` | third-party names |
| Formats / protocols | `RSS`, `Atom`, `OPML`, `API`, `URL`, `SMTP`, `OAuth`, `PDF`, `CSV`, `XML` | technical terms, identical in both languages |
| Fonts / cities / labels | `Times New Roman`, `Courier`, `Bangkok (GMT+7)`, `Hashtag`, `Favicon`, `Top 10`, `IP:`, `SHA-256 HASH` | proper nouns and technical labels |
| Format examples inside placeholders | `+84 xxx xxx xxx`, `1900 xxxx`, `.custom-class { color: red; }`, `tag1, tag2, tag3...`, `AIzaSy...` | illustrative input examples |
| Terminal-style readout on the Scan page | `TARGETS:`, `QUEUE:`, `ACTIVE_JOBS:`, `PING:`, `[ERR]`, `* * * * * (m h d M w)` | deliberately code-style diagnostics alongside already-neutral tokens such as `SYS.WORKER // ONLINE` |
| Developer debug panel | `NEXT_PUBLIC_API_URL:`, `API_BASE_URL (resolved):`, `capabilities URL:` | environment/endpoint identifiers |
| Path prefixes | `src/lib/`, `src/hooks/`, `src/store/`, `src/utils/` | no rendered prose; user-visible text is produced through `t()` at the call site (`lib/apiErrors.ts`, `permissions.getRoleDisplayName(role, t)`) |
| Path prefix | `src/app/dashboard/settings/test-interactive.tsx` | developer scratch component: not a route, not imported anywhere, never rendered |

### Remaining localization limitations

1. **`<meta name="description">` stays Vietnamese.** It lives in the Next.js
   `metadata` export of `src/app/layout.tsx`, a server component that cannot call the
   client-side `t()`. Visible UI is unaffected; only the HTML metadata is fixed to
   one language.
2. **Backend `detail` sentences are still Vietnamese** for endpoints outside this
   change's scope. See the next section for how the frontend prevents that from
   producing mixed-language UI.
3. **Dates and numbers** are rendered with the existing formatting code; no
   locale-aware `Intl` migration was attempted, because changing number/date output
   is a behavioural change beyond this task.

---

## 4. Localized backend errors

Backend error text used to be Vietnamese sentences that the frontend matched by
substring (`detail.includes('cấu hình')`). That is fragile, and it is *why* an English
UI could still show Vietnamese: the message was chosen on the server, where the
user's language is unknown.

The contract is now:

- every error raised through `backend/app/core/api_errors.api_error()` carries a
  stable `code`
- the code travels in the JSON body as `error_code` **and** in the `X-Error-Code`
  response header (`app/main.py`'s `HTTPException` handler mirrors it, and now also
  preserves `exc.headers`, which it previously dropped)
- `detail` keeps its existing Vietnamese sentence, so older callers and direct API
  consumers are unaffected — the addition is backwards compatible
- the frontend maps the code to a translated message

`frontend/src/lib/apiErrors.ts` resolves a message in this order:

1. a translation for the specific `error_code` (39 codes mapped in both languages)
2. a translation for the HTTP status
3. the backend `detail` — **only when the UI language is Vietnamese**, since `detail`
   is always Vietnamese and would otherwise put Vietnamese text into an English UI
4. a generic localized message

So a Vietnamese user keeps the specific server sentence, and an English user gets a
localized message instead of Vietnamese. Endpoints converted to coded errors in this
change: the whole source-management surface (`/api/sources`, `/groups`,
`/discover-feeds`, `/opml/preview`, `/import-feeds`, `/{id}/test`, `/{id}/scan`).
Other endpoints still return an uncoded Vietnamese `detail`; they fall into step 3/4
above, which is why the English UI shows a localized generic message rather than
Vietnamese text.

`PUT /api/sources/{id}` also no longer converts its own `400` into a `500` — its
`except Exception` block caught the `HTTPException` it had just raised.

---

## 5. Source coverage

### What already existed

The RSS path was already real and wired into the normal data flow.
`run_rss_collector` is called from `scan_service.py`, `api/crawl.py`,
`services/search_providers.py` and `api/collectors.py`, and writes to `source_items`
+ `mentions`, which is what the Mentions UI reads. Project source configuration also
already existed (`POST/PUT/DELETE /api/sources` plus the Sources page). No
configuration UI needed inventing, so none was invented.

### Defects fixed

**Wrong project attribution, plus a crash that silently dropped mentions.**
`rss_collector` resolved the owning project with `active_keywords[0]` — the first
active keyword globally, not the keyword that matched — and then read
`kw_group.project_id`, an attribute `KeywordGroup` does not have. (A "project" *is* a
`KeywordGroup` row; see `Subscription.project_id`, a FK to `keyword_groups.id`.) The
resulting `AttributeError` was swallowed by the per-source handler, so a feed aborted
on its first keyword match and **keyword-matched RSS mentions were never stored**.
Attribution now uses the keyword that actually matched, and the project id is that
keyword's `group_id`.

### New: website feed auto-discovery

`backend/app/services/feed_discovery.py` + `POST /api/sources/discover-feeds`.

The user submits a normal public website URL; the backend reads the feeds the page
advertises through the standard autodiscovery convention:

```html
<link rel="alternate" type="application/rss+xml"  href="/feed.xml">
<link rel="alternate" type="application/atom+xml" href="/atom.xml">
```

- fetched through the guarded fetcher (scheme/SSRF/redirect/size limits, pinned destination)
- relative `href`s resolved against the URL actually landed on after redirects
- candidates de-duplicated by normalised URL (scheme+host lowercased, trailing slash and fragment dropped)
- each candidate re-validated, so a feed pointing at an internal address is returned as `blocked` and cannot be selected
- if the submitted URL is itself a feed, it is returned as the single candidate with `input_was_feed: true`
- candidate count capped (25)
- **nothing is created or activated** — the response is a list for the user to choose from
- a page that advertises no feed returns `ok: true` with an empty list: an honest empty state, not an error

### New: OPML import

`backend/app/services/opml_import.py` + `POST /api/sources/opml/preview`.

- file extension restricted to `.opml` / `.xml`; size ceiling 2 MB enforced before parsing
- `<!DOCTYPE …>` and `<!ENTITY …>` **rejected outright**, which removes entity-expansion
  (billion-laughs / XXE) attacks at the source rather than mitigating them
- parsed with `lxml` (already a dependency) using `resolve_entities=False`,
  `load_dtd=False`, `no_network=True`, `huge_tree=False`, `recover=False`
- `xmlUrl` matched case-insensitively (readers differ); nested outlines traversed;
  folder-only outlines skipped
- duplicates within the file counted and collapsed
- outline count capped (500), with `truncated: true` reported when the cap is hit
- each feed screened **structurally** (scheme, credentials, port, literal IP) — no DNS
  at preview time, so a 500-entry file does not fire 500 DNS queries. The full check
  (DNS, address ranges, reachability, real RSS/Atom content) runs per feed at import
- a bare `<body>` export is accepted; an RSS file uploaded by mistake is rejected as `not_opml`

### Persistence requires explicit confirmation

`POST /api/sources/import-feeds` takes the list the user selected and reports an
honest per-feed status:

| Status | Meaning |
| --- | --- |
| `created` | validated and stored |
| `duplicate` | the same URL already exists for this tenant, or is repeated in the request |
| `blocked` | rejected by the URL guards (internal address, bad scheme, port, credentials) |
| `invalid` | reachable but not a valid RSS/Atom document |
| `failed` | fetch/validation failed otherwise (timeout, HTTP error) |

One failing feed never aborts the rest. Imported feeds are created with
`is_active=false` by default, so nothing claims to be collecting before the user has
reviewed it.

### UI

`frontend/src/components/sources/FeedDiscoveryPanel.tsx`, mounted on the Sources
page. Both flows are preview-then-confirm: candidate list with per-feed status
badges, blocked entries rendered unselectable with a localized reason, an explicit
"feeds start disabled" note, and a per-feed result table after import. All strings go
through the vi/en dictionary. It calls only the three real endpoints above
(`/api/sources/discover-feeds`, `/api/sources/opml/preview`,
`/api/sources/import-feeds`) — all three are declared in `backend/app/api/sources.py`.

### Honest integration status

`GET /api/integrations/capabilities` previously reported RSS as `READY` whenever
**any** `sources` row of type `rss` existed, including inactive or permanently failing
ones. It now reports:

| Status | Meaning |
| --- | --- |
| `NO_SOURCES` | no active RSS source configured |
| `PENDING_VALIDATION` | active source(s) exist but no collection run has completed |
| `ERROR` | active source(s) exist and the latest attempts failed |
| `READY` | at least one active source has a real `last_success_at` |

So the card claims "connected" only after the backend has genuinely collected. The
Integrations page maps every status to a localized label and hint, and renders the
raw code rather than silently reading as "ready" if an unmapped status ever appears.

### External APIs — deliberately not added

No new third-party provider was integrated. The existing YouTube / X / SerpAPI / Meta
adapters already read credentials from the settings mechanism and already show an
honest `CONFIG_REQUIRED` state when keys are absent. Adding another provider would
have meant either inventing credentials or shipping an untestable adapter. No
credential, token or key was added anywhere in this change.

---

## 6. SSRF and DNS-rebinding protections

`backend/app/services/feed_fetcher.py` is the single guarded path for every fetch of
a user-supplied URL.

| Guard | Behaviour |
| --- | --- |
| Scheme allowlist | `http`/`https` only; `file:`, `ftp:`, `javascript:`, `gopher:` rejected before any I/O |
| Embedded credentials | `https://user:pass@host/` rejected |
| Address ranges | host resolved and **every** returned address checked; loopback, private, link-local, reserved, multicast and unspecified blocked, including `169.254.169.254` and `[::1]`. If *any* resolved address is internal, the URL is rejected, so a split-horizon answer cannot be cherry-picked |
| Hostname forms | `localhost`, `localhost.localdomain`, `*.localhost` blocked by name |
| Port policy | privileged ports blocked except 80/443/8080/8443, so a feed URL cannot probe SSH/SMTP/Postgres |
| Redirects | followed manually, max 3, and **each hop is validated and re-pinned** — a public URL that redirects to an internal address is rejected at the redirect |
| Timeouts | separate 5 s connect / 15 s read |
| Size | 5 MB ceiling, enforced from `Content-Length` *and* while streaming |
| Error surface | raw socket/DNS/TLS errors logged, never returned; the caller gets a stable code plus a short message |

### DNS rebinding is closed by pinning the destination

The earlier implementation validated DNS and then let `requests` resolve the hostname
again, leaving a TOCTOU window. The connection now goes to the **validated IP**:

- `resolve_target()` returns the URL, the host, the port and the single allowed IP
- the request URL's authority is rewritten to that IP (IPv6 bracketed)
- the original host (with non-default port) is sent as the `Host` header
- for HTTPS, a `_PinnedHTTPSAdapter` sets urllib3's `server_hostname` to the real
  hostname, which is both the SNI value and the name Python's `ssl` module verifies
  the certificate against

So there is **no second resolution**: the address checked is the address connected
to. TLS is untouched — verification stays on, SNI carries the real hostname, and
certificate failures surface as a distinct `tls_error` code. Nothing disables
`verify`, and no `assert_hostname` override is used (the deprecated string form is
ignored by urllib3 2.x, which is why only `server_hostname` is set).

Residual note: pinning applies per hop, and each hop resolves once. A hostile DNS
server can therefore still choose which *public* address is used — it simply cannot
substitute a private one after the check.

`backend/scripts/smoke_test_feed_fetcher.py` exists as an explicitly **manual**
network smoke test (never collected by pytest) that exercises the TLS negative cases
against `badssl.com` — hostname mismatch, untrusted root, expired and self-signed
certificates — plus the blocked metadata and loopback targets. Run it manually when
you want to confirm the TLS claim on your own machine; it was **not run** for this
final state.

### Feed HTML sanitisation

Feed `description`/`content` is third-party HTML and was stored raw in
`Mention.content`. `sanitize_feed_html()` strips `script`, `style`, `iframe`,
`object`, `embed`, `form`, `link`, `meta`, `svg`, `base`; removes every `on*` handler
plus `srcdoc`/`formaction`; and drops `javascript:`, `vbscript:` and `data:text/html`
URLs from `href`/`src`/`action`. Readable markup is preserved; if sanitisation itself
fails it degrades to plain text. No component uses `dangerouslySetInnerHTML`.

### Other ingestion improvements

- per-feed entry cap (`CRAWL_MAX_RESULTS_PER_SOURCE`, default 50, hard max 200)
- a malformed feed fails only its own source; a bad feed can no longer abort a run
- `source.last_error` stored as `"<code>: <message>"` so the Sources UI can key off a
  stable code; the UI gained a distinct **"URL bị chặn"** state for
  `blocked_target` / `unsupported_scheme` / `credentials_in_url` / `blocked_port`
- deduplication verified in code across `normalized_url`, `guid` and `content_hash`

---

## Configuration requirements

| Variable | Purpose | Required |
| --- | --- | --- |
| `NOPE360_BACKEND_URL` | Backend the `scripts/` utilities talk to (default: current production URL) | No |
| `NOPE360_ADMIN_EMAIL` / `NOPE360_ADMIN_PASSWORD` | Primary account for those scripts | Only to run them |
| `NOPE360_USER_*`, `NOPE360_ALT_*`, `NOPE360_ACCOUNT4..7_*` | Secondary accounts used by individual scripts | Optional |
| `NOPE360_DB_URL`, `NOPE360_TARGET_EMAIL`, `NOPE360_NEW_PASSWORD` | `check_db.py` | Only to run it |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_FULL_NAME` | `app.scripts.create_admin` (password min 12 chars) | Only to run it |
| `CRAWL_MAX_RESULTS_PER_SOURCE` | Entries taken per feed (default 50, cap 200) | No |
| `FEED_FETCH_ALLOW_PRIVATE_TARGETS` | Dev-only escape hatch for internal fetch targets. **Never set in production** | No |

No production environment variable was changed, no migration was written, and
nothing was deployed.

---

## Test tooling added

The frontend previously had no runnable test setup: `src/lib/utils/mentions.test.ts`
used jest-style globals, `@types/jest` was declared but not installed, and
`npm run type-check` failed on that file. Rather than hiding the file from type
checking, the project now has the smallest appropriate setup:

- `vitest` + `@vitejs/plugin-react` + `jsdom` + `@testing-library/react` as dev
  dependencies, `vitest.config.mts` and `vitest.setup.ts`
- `types: ["node", "vitest/globals"]` in `tsconfig.json`, which is what actually
  resolves the `describe`/`it`/`expect` errors
- `npm test` / `npm run test:watch` scripts
- a non-interactive `.eslintrc.json` (`next/core-web-vitals`), replacing the
  `next lint` interactive setup prompt that previously blocked linting entirely.
  `react-hooks/exhaustive-deps` is left as a warning: the codebase has ~49
  pre-existing cases and changing effect timing is out of scope here.

Test files added by this task (frontend): `src/i18n/locale.test.ts`,
`src/contexts/LanguageContext.test.tsx`, `src/lib/apiErrors.test.ts`,
`src/components/sources/FeedDiscoveryPanel.test.tsx`.
Test files added (backend): `test_feed_fetcher.py`, `test_rss_ingestion.py`,
`test_feed_discovery_and_opml.py`, `test_sources_discovery_api.py`,
`test_auth_credential_hygiene.py`, `test_repo_secret_hygiene.py`.

`.gitignore` had a blanket `test_*.py` rule (intended for ad-hoc scripts at a project
root) that also silenced every new file in `backend/tests/`. A
`!backend/tests/test_*.py` negation was added so real suites stay tracked.

`backend/tests/test_sources_discovery_api.py` applies its FastAPI
`dependency_overrides` per test and restores the previous mapping afterwards. `app`
is a module-level singleton shared by every test file, so setting overrides at import
time makes results depend on import order.

---

## Verification status

**Local tests, type-check, lint, build and runtime/browser verification were not run
for the final state of this branch, by explicit user instruction.** No claim is made
here that any check passes on this commit.

What *was* done for this pass, without executing anything:

- static review of the full diff: imports and referenced symbols, translation keys
  used by changed components cross-referenced against both dictionaries, frontend API
  paths cross-referenced against the routes declared in `backend/app/api/sources.py`
- searches for merge-conflict markers (0), `dangerouslySetInnerHTML` (0), disabled TLS
  verification (0), token-shaped literals (0), cookie writes (0), remote DSNs with
  credentials (0 — the only two matches are `user:password@host` placeholders in
  `.env.example` and a code comment)
- the obsolete backend host appears in exactly two places, both of which name it in
  order to *refuse or detect* it: `scripts/_env_config.py` (`RETIRED_BACKEND_HOSTS`)
  and `backend/tests/test_repo_secret_hygiene.py` (`RETIRED_BACKEND_HOST`)
- `git diff --check` clean; `backend/app/schemas/service.py` untouched
- 15 password-shaped matches in the diff are all i18n **labels**
  (`smtpPassword: 'SMTP password'`, `newPassword: 'New password'`, …), not values
- no duplicate top-level section in either dictionary (27 each); the AST-based parity
  checker reports 2,156 keys in both

### Known baseline test failures (context only, not re-verified here)

An earlier run of the full backend suite in this environment showed 20 failures that
reproduce identically on the base commit `8700ba6` in a clean worktree. They are
environmental, not caused by this change:

- no local PostgreSQL on `127.0.0.1:5432` (`psycopg2.OperationalError: connection refused`)
- `test_cache.py` async tests need an async pytest plugin, which is suppressed because
  the interpreter's `langsmith` plugin otherwise crashes pytest at plugin-load time
  with a pydantic v1 error, requiring `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1`

Two environment notes for whoever runs the suite: `backend/venv` has the application
dependencies but **no pytest** and **no croniter**; the global Python 3.12 has both.

---

## Known limitations

1. **The Chrome popup is not fixed by code and cannot be.** You must change the
   breached/reused password. Any claim that a code change silenced it would be false.
2. **Git history still contains the leaked credentials.** History was deliberately not
   rewritten. Rotation is the only remedy (see section 1).
3. **No verification was performed for this final state** — see
   [Verification status](#verification-status).
4. **`<meta name="description">` remains Vietnamese** (server-side `metadata` export).
5. **Backend `detail` text outside the source-management surface is still
   Vietnamese-only.** The frontend prevents mixed-language UI by falling back to a
   localized generic message for English users, at the cost of specificity there.
6. **Date/number formatting is not locale-aware.**
7. **DNS rebinding is closed for private-address substitution**, but a hostile DNS
   server can still choose which public address is used.
8. **No new external data provider was added.** Source coverage gained website feed
   auto-discovery and OPML import; the set of supported platforms did not grow.
9. **`backend/app/schemas/service.py` was not touched**, per project rules.

---

## Manual verification steps

Backend:

```bash
cd backend && python -m compileall app
```

```bash
cd backend && python -m pytest tests/ -q
```

Frontend:

```bash
cd frontend && npm run type-check
```

```bash
cd frontend && npm run lint
```

```bash
cd frontend && npm run build
```

```bash
cd frontend && npm test -- --run
```

```bash
cd frontend && npm run check-i18n
```

```bash
cd frontend && npm run check-locales
```

```bash
cd frontend && npm run check-hardcoded
```

Manual network smoke test for the TLS/SSRF claims:

```bash
cd backend && python scripts/smoke_test_feed_fetcher.py
```

Browser checks a human should perform:

1. On `/login`, switch between Tiếng Việt and English and confirm every string
   changes, including placeholders and button labels.
2. In DevTools run `localStorage.setItem('app_language','ja')`, reload, and confirm the
   UI is Vietnamese **and** the stored value has been rewritten to `vi`. Repeat with
   `th`, `ko`, `zh` and a nonsense value such as `xx-YY`.
3. Select English, reload, and confirm English persists.
4. Sign in and walk the dashboard, mentions, analysis, comparison, influencers,
   sources, integrations, project settings, reports, AI assistant and services routes
   in both languages, at desktop and at a mobile viewport.
5. On `/dashboard/sources`, paste a site that advertises a feed (for example
   `https://wordpress.org/news/`) and confirm the feeds are listed but **not** added
   until you confirm; then paste a site with no feed and confirm the honest empty
   state.
6. Import an OPML file containing a valid feed, a duplicate, and
   `http://169.254.169.254/latest/meta-data/`; confirm the per-feed statuses and that
   the blocked entry cannot be selected.
7. Add `http://127.0.0.1`, `http://localhost` and the metadata address as sources and
   confirm each is rejected.
8. Enable one real feed, run collection twice, and confirm the second run creates no
   duplicates and that the mentions appear with real source provenance.
9. On `/dashboard/integrations`, confirm the RSS card shows "Chưa có nguồn" before any
   feed is added, "Chờ kiểm tra" after adding one, and "Đang hoạt động" only after a
   successful collection.
10. Change the password Chrome flagged as breached, then sign in again.
