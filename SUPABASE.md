# Supabase setup

IELTShack uses the shared ecosystem Supabase project (one database for SAThack,
AdmissionHack and IELTShack), with every IELTShack object isolated behind an
`ielts_` prefix and its own row-level-security policies.

## Project

| | |
| --- | --- |
| Project ref | `arpwvfphzryaaxrvegju` |
| Region | `ap-northeast-2` |
| URL | `https://arpwvfphzryaaxrvegju.supabase.co` |
| Auth | shared `auth.users` pool across the ecosystem |

Environment variables (`.env.local`, and the same keys in Vercel):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://arpwvfphzryaaxrvegju.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable or anon key>
```

The anon/publishable key is safe to ship to the browser; every table is protected
by RLS.

## Tables

All tables live in `public`, prefixed `ielts_`. Migration:
`supabase/migrations/20261021000100_ieltshack_init.sql` plus the admin and account-deletion fixes (idempotent).

| Table | Purpose | Access |
| --- | --- | --- |
| `ielts_profiles` | name, email, target band, test date, weekly hours | own row only |
| `ielts_attempts` | one row per finished session with answers and bands | own rows |
| `ielts_saved_questions` | bookmarked question ids | own rows |
| `ielts_vocab_progress` | known/seen per vocabulary word | own rows |
| `ielts_plan_tasks` | weekly checklist state | own rows |
| `ielts_writing_drafts` | Task 1/2 drafts + checklist | own rows |
| `ielts_speaking_ratings` | self-ratings per cue card | own rows |
| `ielts_community_posts` | community feed | readable by all signed-in users, writable by author |
| `ielts_post_likes` | one like per user per post | readable by all signed-in users, own writes |
| `ielts_admins` | admin membership | own row readable; no write policy (SQL/service role only) |
| `ielts_ai_usage` | per-user daily AI evaluation count | own row readable; writes only through `ielts_consume_ai_quota()` |
| `ielts_review_items` | reviewed miss-queue questions | own rows only |
| `ielts_content_reports` | learner-flagged question problems | owner inserts/reads; admin triage via RPC |

A trigger `ielts_on_auth_user_created` creates the profile row on sign-up.
A trigger `ielts_post_likes_sync` maintains the denormalised `likes` count.

Admin RPCs (all `security definer`, executable by authenticated users only):

- `ielts_is_admin()` — boolean for the current user.
- `ielts_admin_stats()` — platform counts; raises unless admin.
- `ielts_admin_delete_post(uuid)` — moderation delete; raises unless admin.
- `ielts_admin_reports()` / `ielts_admin_resolve_report(uuid)` — content-report triage; raise unless admin.
- `ielts_delete_my_account()` — deletes only this app's rows for `auth.uid()`. It does
  **not** delete the shared `auth.users` identity, so SAThack access survives.

## Data flow in the app

- Supabase is the source of truth; `localStorage` is a cache so the UI stays fast
  and works briefly offline.
- On sign-in and whenever the tab becomes visible, `pullRemote()`
  (`src/lib/remote.ts`) refreshes the cache from Supabase.
- Writes are mirrored with fire-and-forget inserts/upserts: attempts, saved
  questions, vocabulary, plan tasks, writing drafts, speaking ratings, community
  posts and likes.
- RLS is the security boundary: a user can only read or write their own rows
  (except community reads).

## Shared auth pool — important

Because all three apps share one Supabase project, they also share `auth.users`.
A learner can sign in to IELTShack and hold a valid ecosystem session. What they
can *see* is determined by each app's RLS policies, so:

- Never build policies on "authenticated" alone for user data — always scope to
  `auth.uid()`.
- If you later want separate user pools, create a separate Supabase project and
  move the `ielts_*` tables plus this migration; the app only reads the two env
  variables, so no code changes are needed.

## First-time database setup

Apply the migration once (already done for the shared project):

```bash
supabase db push
```

or paste `supabase/migrations/20261021000100_ieltshack_init.sql` into the SQL
editor. Every statement is idempotent.

## Auth notes

- Email/password sign-up is enabled.
- Email confirmation is on: users confirm via the Supabase email, then sign in.
- Password reset: `/auth/forgot` sends the Supabase reset email; `/auth/reset`
  exchanges the code and updates the password.
- Account deletion: Settings → Delete IELTShack data calls `ielts_delete_my_account()`,
  which removes app data only. The shared ecosystem login stays intact.
- There is no service-role key in the app; nothing bypasses RLS.

## Granting admin access

Admin membership is intentionally manual (no API can add it):

```sql
insert into public.ielts_admins (user_id)
values ('<auth-user-id>')
on conflict (user_id) do nothing;
```

Then visit `/dashboard/admin/console`. The console shows platform counts, content
inventory, and post moderation.
