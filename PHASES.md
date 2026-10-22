> **Paused 2026-10-21 — resume 2026-10-23.**
> The local dev server is stopped. **Do not pause the Supabase project**: it is
> shared with SAThack. Next up: (1) bring AdmissionHack into the ecosystem (its
> deployment is paused; source/access needed), (2) load real practice tests and
> listening audio, (3) deployment (Vercel env vars + Supabase Site URL/redirects).

# IELTShack — build phases

Full IELTS preparation platform, adapted from the SAThack product and design system.
Content (practice tests and question bank) is added last, through the content model from
Phase 2, without touching application code.

Legend: `[x]` done · `[~]` partial / working first pass · `[ ]` not started

---

## Phase 0 — Discovery and architecture `[x]`

- Audited the reference: 22 routes (marketing, auth, onboarding, dashboard, practice,
  review, bank, plan, analytics, community, tutor, vocab, leaderboard, admin).
- Extracted the design tokens, fonts, and the full stylesheet.
- Found the database schema is not reproducible from the repo (migrations only), so a
  new app is built with a swappable content/data layer instead of forking the backend.
- Decided the IELTS domain model: four skills, band 0–9 with half bands, question types
  (MCQ, gap fill, matching, T/F/NG, short answer), 40-question sections.

## Phase 1 — App foundation `[x]`

- [x] Next.js (App Router) + TypeScript scaffold.
- [x] Design system wired in (fonts, tokens, components, motion).
- [x] Landing page ported into the app at `/`.
- [x] Demo auth at `/auth`, session persisted locally, onboarding at `/onboarding`.
- [x] App shell: collapsible sidebar, top bar, responsive drawer, route transitions.
- [x] Route for every screen in the product.

## Phase 2 — Content model and importer `[~]`

- [x] Schema for tests, sections, passages, questions, answer keys, explanations, bands.
- [x] JSON content directory (`content/`) + typed loader used by every screen.
- [x] Sample diagnostic and reading set built from the schema.
- [x] Validation script (`npm run validate:content`).
- [x] In-app content importer (`/dashboard/admin`): paste/upload, validate, download.
- [ ] Optional bulk CLI importer for large CSV/JSON batches.
- [x] `CONTENT_GUIDE.md` hand-off documentation.

## Phase 3 — Practice engine `[~]`

- [x] Diagnostic: four-skill placement with timer.
- [x] Section-based runner matching the real exam (studied on Engnovate): whole section
      visible, passage/audio beside questions, answer-sheet navigation, submit per section.
- [x] Inline form/note completion, shared heading banks, listening Part 1–4 dividers.
- [x] Practice mode reveals answers and explanations after submitting a section.
- [x] Question renderers: MCQ, multi-select, gap fill, True/False/Not Given, matching,
      short answer, writing textarea, speaking prompt.
- [x] Split passage view.
- [x] Section review and full-test review with explanations.
- [x] Raw → band conversion (official-style 40-question tables, short-set estimate).
- [x] Results screen with band breakdown.
- [ ] Autosave/resume a session mid-test.
- [ ] Listening audio content and real timing per part.

## Phase 4 — Dashboard and analytics `[~]`

- [x] Home: band stats, target, streak, XP, skill breakdown, recent activity.
- [x] Study plan: weekly tasks, check-off, priorities from weakest skill.
- [x] Analytics: band trend and accuracy by skill.
- [x] Review queue (misses first), saved questions.
- [x] Question bank browser with skill/type/search filters, server-side search and
      pagination over 24,572 questions.
- [x] Practice-test library with search, kind/skill filters and pagination (816 tests).
- [ ] Question-type heatmap and time-per-question analytics.
- [ ] Spaced-repetition scheduling for the review queue.

## Phase 5 — Gamification and social `[~]`

- [x] XP, levels, streaks, badges.
- [x] Local leaderboard with demo players.
- [x] Duel: five-question, 15-second timed battles against a simulated rival.
- [x] Community: local feed with posting and likes, study-group directory.
- [ ] Real multiplayer rankings and synced posts.

## Phase 6 — Tutor and vocabulary `[~]`

- [x] Tutor UI with rule-based IELTS answers.
- [x] Vocabulary flashcard trainer with known/learning state.
- [x] Writing workspace: timed Task 1/2, live word count, band checklist, autosaved drafts,
      model answers.
- [x] Speaking practice: 182-card cue bank, 60s prep + 2min speaking timers, notes,
      microphone recording with in-browser speech-to-text, playback, four-criteria
      self-rating and AI examiner feedback.
- [x] AI examiner for writing and speaking: band estimate, four criterion scores,
      strengths and next steps (`/api/ai/evaluate`), with a labelled local fallback
      when no provider key is set.
- [ ] Live AI model provider for the chat tutor + quota.
- [ ] Recorded speaking playback and pronunciation feedback.

## Phase 7 — Accounts and admin `[x]`

- [x] Real Supabase auth (sign-up, sign-in, email confirmation, sign-out) in the
      shared ecosystem project.
- [x] Server-side persistence: profiles, attempts, saved questions, vocabulary,
      plan tasks, writing drafts, speaking ratings, community posts and likes.
- [x] Cross-device sync (pull on sign-in / tab focus, push on every write).
- [x] RLS on every table, scoped to `auth.uid()`.
- [x] Password reset pages (request + code exchange + update).
- [x] Account deletion via a scoped security-definer RPC; local data export already
      covers the synced cache.
- [x] Admin console: platform counts, content inventory, post moderation.
- [x] Role gating via `ielts_admins` (no self-promotion policy).
- [ ] Audit log for admin actions.

## 2026-10-22 — Engnovate-informed test UX

- Studied one reading, listening, writing and speaking test on engnovate.com.
- Replaced the one-question-at-a-time runner with a section-based exam flow.
- Added inline gap blanks, grouped matching headings, listening part dividers and
  per-section answer sheets.
- Added `/api/questions` (ids / testId / skill / type / search) and removed bulk
  question props from pages.
- Cleaned common import artifacts (bullet prefixes, `Example:`/`Answer:` fragments,
  cross-reference numbers) at render time.
- Remaining content caveat: the 816 imported tests need QA (some prompts and
  answer mappings are imperfect) and their audio is hosted by a third party.

## Phase 8 — Production polish `[~]`

- [x] Custom 404, sitemap, robots.
- [x] Responsive QA at 390 / 1440 (drawer, grids, predictor, editor).
- [x] Accessibility: skip link, focus-visible rings, `aria-current`, Escape closes the
      drawer, pressed-state tabs, contrast bump for faint text, reduced-motion rules.
- [x] Per-page metadata and titles, Open Graph/Twitter defaults, theme color.
- [x] Performance: self-hosted font subsets, no external requests, auth routes noindex.
- [ ] Deployment configuration and release checklist (deferred to the final step).

---

## Content hand-off (after Phase 2)

You fill practice tests by dropping JSON into `content/tests` and running
`npm run validate:content`. No code changes required. See `CONTENT_GUIDE.md`.
