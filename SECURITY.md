# Security notes

## Verified controls

- **Session gate:** dashboard routes are server-rendered only after `getServerUser()`; anonymous requests are redirected to `/auth`.
- **API gate:** `/api/questions` and `/api/ai/evaluate` require a Supabase bearer token when Supabase is configured.
- **RLS:** every `ielts_*` table has row-level security. A two-account smoke test verified:
  - user B reads 0 of user A's attempts and saved questions
  - user B cannot insert an attempt for user A (`403`)
  - user B can read a community post but cannot delete it; A's post remains
  - temporary test users were deleted afterwards (0 left)
- **Account deletion:** removes only app rows; it never deletes `auth.users`.
- **Likes:** the counter trigger is `security definer`; clients cannot rewrite the `likes` column.
- **AI:** only current Writing/Speaking content prompts are accepted; per-user 20/day and global 200/day caps are enforced in Postgres; 4k prompt cap, 700 output tokens, 45s timeout.
- **Headers:** CSP, HSTS, frame-deny, nosniff, referrer policy, permissions policy.
- **Dependencies:** `npm audit` should stay at 0; the release check enforces production dependencies.
- **Secrets:** `.env.local` is ignored; only publishable Supabase values ship to the browser.

## Commands

```bash
npm run release:check   # content, grading tests, audit, typecheck, build
npm run rls:test        # requires service-role env; creates/deletes temp users
npm run test:e2e        # public production smoke; set E2E_EMAIL/E2E_PASSWORD for auth
```

## Known gaps

- CSP still permits inline scripts (`'unsafe-inline'`); no nonce/hash yet.
- No Sentry/log drain; only `/api/health` plus console logging.
- No PITR; see [BACKUP.md](./BACKUP.md).
- The AI key is not set in Vercel, so the AI route currently returns the local heuristic.
- Content report spam is not rate-limited.
- Community posts are visible to all authenticated ecosystem users; author display names are client-supplied.
- Attempt scores are client-written; this affects leaderboard integrity, not tenant isolation.
