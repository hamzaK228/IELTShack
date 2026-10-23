# Deployment

Phase 8 release checklist. The app deploys to Vercel as a standard Next.js project;
no custom server is required.

## 1. Prerequisites

- Node 24 and npm.
- The shared ecosystem Supabase project with the `ielts_*` tables already applied
  (`20261021000100_ieltshack_init.sql`, the admin migration, and `20261023000100_ieltshack_fix_account_delete.sql`, `20261023000200_ieltshack_security_hardening.sql`).
- A Vercel account with the repository connected.

## 2. Environment variables

Set these in Vercel → Project → Settings → Environment Variables (Production and Preview):

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | `https://arpwvfphzryaaxrvegju.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | publishable/anon key (safe in the browser; RLS protects data) |
| `OPENAI_API_KEY` or `AI_API_KEY` | optional | enables real AI writing/speaking evaluation |
| `AI_MODEL` | optional | default `gpt-4o-mini` |
| `AI_BASE_URL` | optional | any OpenAI-compatible endpoint |
| `AI_DAILY_LIMIT` | optional | per-user daily evaluations; default 40 |

Locally these live in `.env.local` (git-ignored). See `.env.example`.

## 3. Supabase auth settings

In Supabase → Authentication → URL Configuration:

- **Site URL:** leave it on the ecosystem's primary app (SAThack). It is a single
  project-wide fallback; changing it to IELTShack would break SAThack's auth emails.
- **Redirect URLs:** add, without removing SAThack's entries:
  - `https://ieltshack.vercel.app/**`
  - `https://ieltshack.vercel.app/auth/reset`
  - `https://ieltshack.vercel.app/auth/callback`
  - `http://localhost:3000/**` (local development)
  - the Vercel preview pattern if you use previews, e.g. `https://*-hamzak228s-projects.vercel.app/**`

Sign-up passes `emailRedirectTo` to `/auth/callback`, and password reset passes
`/auth/reset`, so both work once their URLs are allow-listed. If a URL is missing
from the list Supabase silently falls back to the Site URL, which is why
confirmation and reset emails can land on the wrong app.

Without this, confirmation and password-reset emails point at localhost or SAThack.

Email confirmation is enabled: users must confirm before signing in. Customize the
confirmation/reset templates in Supabase if you want branded emails.

## 4. Build

```bash
npm ci
npm run validate:content   # must pass
npx tsc --noEmit           # must pass
npm run build              # must pass
```

Or run all three:

```bash
npm run release:check
```

Content is read from `content/` at runtime; `next.config.ts` traces it into the
serverless bundle via `outputFileTracingIncludes`. If you add content in production,
redeploy so the static test library rebuilds.

## 5. Deploy

Connect the repository in Vercel, framework preset **Next.js**, default build command.
The security headers in `next.config.ts` apply automatically (HSTS, nosniff,
frame-deny, referrer policy, microphone limited to self for speaking practice).

## 6. Post-deploy smoke test

1. Landing page loads with fonts and motion.
2. `/auth` sign-up → confirmation email → sign-in → onboarding → dashboard.
3. Open a reading test (40 questions) and a listening test (audio + 40 questions).
4. Submit a reading section and confirm the band + answer sheet appear.
5. Writing workspace: type 60+ words → Check with AI (shows "AI examiner" if a key
   is set, otherwise "local estimate").
6. Speaking: allow the microphone, record, stop, check the transcript and AI result.
7. Settings: export data, sign out; `/dashboard` redirects to `/auth` afterward.
8. Admin console (`/dashboard/admin/console`) only for a user in `ielts_admins`.

## 7. Rollback

Vercel → Deployments → previous deployment → **Promote to Production**. Database
migrations are additive and idempotent; no rollback is needed for an app rollback.

## 8. Known limits before launch

- 16 listening prompts are blank, 274 letter-only option sets remain, and the
  project audit reports 128 findings (including 13 answer-key mismatches). The
  library quarantines the worst tests; the rest still need a content QA pass.
- 19 reading questions, 294 writing prompts and 1 speaking prompt are ungraded by
  design.
- The shared ecosystem account means an IELTShack signup is also an authenticated
  SAThack user; data isolation depends on each app's RLS. Review SAThack policies.
- One account is not one-click SSO across domains; that needs a shared parent domain
  or a token handoff.
