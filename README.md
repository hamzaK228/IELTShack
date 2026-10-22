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
- **Question bank** at `/dashboard/question-bank` — server-side search across 24,572
  questions, filters, pagination, show answer, save.
- **Review queue**, **Saved**, **full attempt review**.
- **Study plan** — weekly tasks, check-off persistence, priorities from weakest skill.
- **Analytics** — band trend, accuracy by skill.
- **Progress** — XP, level, streak, badges, demo leaderboard.
- **Writing** — timed Task 1/2, live word count, band checklist, autosaved drafts,
  model answers.
- **Speaking** — 182-card cue bank, prep/speak timers, microphone recording with
  in-browser transcription, playback, self-rating and AI examiner feedback.
- **Duel** — five-question, 15-second battles against a simulated rival.
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
  post moderation (admin membership via the `ielts_admins` table).
- **Content import** at `/dashboard/admin` — paste a test JSON, validate it, download the file.
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
- `reference/` — captured reference markup kept for provenance.

## Notes

- Accounts and all practice data persist in Supabase and sync across devices; the
  browser copy is a cache.
- The tutor and leaderboard remain local/demo until their live providers land.
- IELTShack is part of the AdmissionHack ecosystem, sharing one Supabase account
  pool with SAThack — see [ECOSYSTEM.md](./ECOSYSTEM.md) and
  [SUPABASE.md](./SUPABASE.md) for the isolation rules.
- 816 imported tests / 24,572 questions are loaded from `content/tests` (audio URLs point
  at practicepteonline). They are study material, not verified official IELTS papers, and
  some carry extraction artifacts (odd prompts, cross-references). Review before launch.
