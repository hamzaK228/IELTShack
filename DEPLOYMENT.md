# Deployment

Phase 8 release checklist. The app deploys to Vercel as a standard Next.js project;
no custom server is required.

## 1. Prerequisites

- Node 24 and npm.
- The shared ecosystem Supabase project with the `ielts_*` tables already applied
  (`supabase/migrations/20261021000100_ieltshack_init.sql` and the admin migration).
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

Locally these live in `.env.local` (git-ignored). See `.env.example`.

## 3. Supabase auth settings

In Supabase → Authentication → URL Configuration:

- **Site URL:** your production origin, e.g. `https://ieltshack.vercel.app`
- **Redirect URLs:** add
  - `https://ieltshack.vercel.app/auth/reset`
  - `https://ieltshack.vercel.app/**`
  - the Vercel preview pattern if you use previews, e.g. `https://*-<team>.vercel.app/**`

Without this, confirmation and password-reset emails point at localhost.

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

- 292 reading and 177 listening prompts are generic placeholders for image/table
  tasks and need a visual QA pass.
- 16 reading questions and 1 listening question are ungraded because the source key
  is blank.
- The shared ecosystem account means an IELTShack signup is also an authenticated
  SAThack user; data isolation depends on each app's RLS. Review SAThack policies.
- One account is not one-click SSO across domains; that needs a shared parent domain
  or a token handoff.
