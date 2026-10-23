# IELTShack

An IELTS preparation platform built on the SAThack design system and product patterns:
diagnostic, practice engine, question bank, study plan, analytics, gamification, vocabulary,
and a tutor — all rebranded and reworked for IELTS (four skills, band 0–9).

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Reference design system (CSS tokens, JetBrains Mono) served from `public/assets`
- Content in JSON under `content/tests`
- Supabase auth + Postgres persistence (shared ecosystem project, `ielts_*` tables),
  with `localStorage` as an offline cache

## Run

```bash
npm install
cp .env.example .env.local   # Supabase URL + publishable key
npm run dev                  # http://localhost:3000
```

Checks:

```bash
npm test                     # grading regression tests
npm run lint                 # TypeScript check
npm run release:check        # content + tests + dependency audit + typecheck + build
npx playwright install chromium
npm run test:e2e             # public smoke tests; defaults to production, override with E2E_BASE_URL
```

Database and auth details: [SUPABASE.md](./SUPABASE.md).

Production:

```bash
npm run build && npm start
```

## What works today

- **Landing page** at `/` — the full SAThack landing, rebranded, with all motion.
- **Auth** at `/auth` — real Supabase email/password accounts, shared ecosystem session; the demo button remains only when Supabase env is absent.
- **Onboarding** at `/onboarding` — target band, baseline, test date, weekly hours.
- **Dashboard** at `/dashboard` — band stats, streak, XP, skill breakdown, recent activity.
- **Diagnostic** at `/dashboard/diagnostic` — four-skill placement test, scored and saved.
- **Practice engine (section-based)** — matches the real test flow studied on Engnovate:
  the whole section at once, passage/audio beside the questions, inline blanks for
  form/note completion, shared heading banks, question navigator, count-up timer,
  submit per section, then an answer sheet with per-skill bands.
- **Practice tests** at `/dashboard/test` — 816 tests, search/filter, pagination.
- **Review queue** — every missed question, with a clearable “Got it” state synced to
  `ielts_review_items`; **full attempt review** from saved attempts.
- **Saved** — bookmark state is still stored, but the Saved page was removed in the
  2026-10-22 narrowing.
- **Study plan** — weekly tasks, check-off persistence, priorities from weakest skill.
- **Analytics** — band trend, accuracy by skill.
- **Progress** — XP, level, streak, badges, demo leaderboard.
- **Writing in practice/mock** — Task 1/2 prompts inside the section runner, live word
  count and AI examiner feedback. The standalone Writing page was removed.
- **Speaking in the mock** — 179 Part 2 cue cards, prep/speak timers, microphone
  recording with in-browser transcription, playback, self-rating and AI feedback. The
  standalone Speaking page was removed.
- **Community** — feed with posting and likes persisted in Supabase; study-group directory.
- **Vocabulary** — flashcard trainer with known/learning state.
- **Tutor** — rule-based demo grounded in IELTS strategy.
- **AI examiner** — writing and speaking answers get a band estimate, criterion
  scores and next steps (`/api/ai/evaluate`; works with an OpenAI-compatible key,
  local estimate otherwise). See [AI.md](./AI.md).
- **Settings** — goals, export JSON, reset progress, sign out, delete IELTShack data
  (the shared ecosystem login remains).
- **Password reset** — `/auth/forgot` and `/auth/reset`.
- **Admin console** at `/dashboard/admin/console` — platform counts, content inventory,
  post moderation and question-report triage (admin membership via `ielts_admins`).
  The content-import page was removed; add JSON files to `content/tests` instead.
- **Legal** — `/terms`, `/privacy`.

## Adding tests

See [CONTENT_GUIDE.md](./CONTENT_GUIDE.md). Drop a JSON file into `content/tests`, run:

```bash
npm run validate:content
```

No application code changes are required.

## Project docs

- [PHASES.md](./PHASES.md) — the build plan and current status.
- [CONTENT_GUIDE.md](./CONTENT_GUIDE.md) — test/question schema and scoring rules.
- [ECOSYSTEM.md](./ECOSYSTEM.md) — shared-account contract for SAThack,
  AdmissionHack and IELTShack.
- [DEPLOYMENT.md](./DEPLOYMENT.md) — release checklist, env vars, Supabase auth URLs.
- [SECURITY.md](./SECURITY.md) — verified controls, RLS test, and known gaps.
- [MONITORING.md](./MONITORING.md) — health checks and uptime monitor setup.
- [BACKUP.md](./BACKUP.md) — app-data backup and recovery runbook.
- `reference/` — captured reference markup kept for provenance.

## Notes

- Accounts and all practice data persist in Supabase and sync across devices; the
  browser copy is a cache. Dashboard routes now require a server-validated session.
- AI evaluation requires a session and is capped per user per day (`AI_DAILY_LIMIT`).
- The tutor and leaderboard remain local/demo until their live providers land.
- IELTShack is part of the AdmissionHack ecosystem, sharing one Supabase account
  pool with SAThack — see [ECOSYSTEM.md](./ECOSYSTEM.md) and
  [SUPABASE.md](./SUPABASE.md) for the isolation rules.
- 816 imported tests / 26,402 questions are loaded from `content/tests` (audio URLs point
  at practicepteonline). They are study material, not verified official IELTS papers, and
  some carry extraction artifacts (odd prompts, cross-references). Review before launch.
