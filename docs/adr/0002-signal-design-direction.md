# ADR 0002 — Adopt the SIGNAL design direction for Nope360 premium UI

- **Status:** Accepted
- **Date:** 2026-07-26
- **Decision makers:** Product owner (direction chosen from Awwwards reference taste, 2026-07-26); Hermes orchestrator (recording)
- **Epic:** SIGNAL (`feat/epic-signal-premium-ui`)
- **Note:** numbered 0002 per the epic brief; this is the first ADR committed under `docs/adr/` on this branch.

## Context

1. A premium frontend redesign was previously attempted and **deliberately rolled back**: PR #171 "selectively rollback premium frontend redesign", then PR #172 "restore frontend to PR 168 state". `origin/main` (8700ba6) therefore carries the PR-168-era frontend.
2. Issue #175 asked for an evidence package for the "public-experience V2" work living uncommitted in the protected worktree `workspaces/nope360-public-experience-v2`. That work raised, but did not answer, the design-direction question.
3. On 2026-07-26 the product owner chose a new direction from eight Awwwards references (Vectr, The State of the Gallery, Ricardo Chance, HAOQI.DESIGN, WebFactory, zeroz, [PORTFOLIO], Sharplink) and issued the Epic SIGNAL brief ("Design Constitution & Master Prompt").

## Decision

Adopt **SIGNAL** as the design direction for the Nope360 public site and dashboard: *the internet is noise; Nope360 turns it into signal.* Particle/waveform fields of raw mentions resolving into clean, precise insight.

Constitution (binding for all epic workers; violations fail review):

- **Palette (dark-first):** void base `#050510`; surface `#0B0B1A`; exactly ONE electric blue-violet accent, tokenized as `--signal` (never hardcoded); paper text `#F4F2EC`; first-class sentiment tokens (positive/negative/neutral). Light mode is a separately designed variant — never a naive inversion.
- **Typography:** oversized editorial display (clamp ~3.5–8rem), grotesque sans, tight tracking, giant metric numerals, small-caps eyebrow labels.
- **Motion:** scroll-driven scenes and scene transitions; canvas particle hero (WebGL optional, never required); magnetic hovers; glass tiles with believable depth. Hard limits: 60fps, `prefers-reduced-motion` fully honored, motion never blocks reading, LCP < 2.5s, zero CLS.
- **Precision:** 8px grid; a single design-tokens source wired into Tailwind; deep reusable components (`Section`, `Display`, `MetricStat`, `GlassTile`, `MentionParticleField`, `SentimentBadge`).
- **Never:** wireframe/dev-panel/generic-SaaS look; fake data, logos, stats, or testimonials (placeholders are flagged `COPY_TBD` for human copywriting); dark→light inversion; landing spectacle copied into the dashboard.

**Motion library: Framer Motion** (v11, already a project dependency). GSAP is rejected for this epic — it would add a new runtime dependency for capabilities Framer Motion + a hand-rolled canvas particle field already cover. The particle hero is plain canvas 2D, not WebGL.

**Display typeface: Space Grotesk** via `next/font/google` (latin + vietnamese subsets, exposed as `--font-display` / Tailwind `font-display`; zero dependency changes). Decided 2026-07-26 after W-A review flagged Inter-as-display as the generic-SaaS tell the constitution forbids. Body text remains Inter.

**Lint gate:** the repo ships eslint deps with no config (pre-existing gap, three workers confirmed). An epic chore ticket adds `.eslintrc.json` (`next/core-web-vitals`); legacy-code violations may be downgraded to warnings with an explicit documented list, so the epic's lint gate means "no new errors". Full lint enforcement over the assembled epic happens at the W-F evidence stage before the epic→main PR.

**Scope:** frontend only. No `backend/**`, no `alembic/**`; the only permitted dependency additions are dev-deps for evidence (axe/Playwright), each recorded here if added.

## Supersession

- This epic **supersedes the rolled-back premium redesign** (#171/#172 history) — it is a new direction, not a revival of the reverted one.
- **Issue #175 is superseded by Epic SIGNAL.** Its partially completed evidence package (secret scan, type-check, lint, build — all PASS; `origin/main` divergence analysis) is retained as historical record under `agent-company/state/ISSUE_175_V2_EVIDENCE_PACKAGE.md` and `agent-company/artifacts/nope360-public-experience-v2/issue-175/`.
- The worktree `workspaces/nope360-public-experience-v2` (uncommitted V2 drafts: `PublicSiteShell.tsx`, `/about`, `/features`, auth restyles) becomes a **read-only reference**: epic workers may copy reusable structure from it into their own worktrees; nothing may modify it.

## Consequences

- The landing page (`/`), `/about`, `/features`, `/login`, `/register` are rebuilt in the SIGNAL system; the dashboard receives a same-token, dense-but-premium sync pass (calm micro-transitions only).
- All visual work flows through the design-token source; reviewers reject hardcoded palette values.
- Evidence gates for the epic: type-check, lint, build, Playwright screenshot matrix (desktop+mobile × dark+light), axe accessibility, perf budget (LCP < 2.5s, CLS 0), reduced-motion verification, secret scan.
- Delivery stops at `READY_FOR_EXPLICIT_MERGE_APPROVAL`; merge to `main` remains a human decision.
