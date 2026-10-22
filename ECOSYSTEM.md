# Ecosystem contract — SAThack · AdmissionHack · IELTShack

The three products are one ecosystem: **one learner identity, separate app data**.
This document is the contract every app follows.

## Identity

| | |
| --- | --- |
| Auth host | Supabase project `arpwvfphzryaaxrvegju` (`ap-northeast-2`) |
| Account | one `auth.users` row per person |
| Login | email + password, shared across apps |
| Email confirmation | shared |
| Password reset | shared — resetting from any app changes the password everywhere |
| Sessions | per-domain browser cookies; each app still signs in on its own domain |

**One account does not mean one click.** Separate domains cannot share Supabase
cookies. Today each app signs in independently with the same credentials. True
single sign-on requires either:

1. custom subdomains on one parent domain (`ieltshack.example.com`,
   `admissionhack.example.com`) with the auth cookie scoped to `.example.com`, or
2. a redirect-based token handoff between the apps.

## Data isolation

Every app owns a table prefix. No app reads another app's tables.

| App | Prefix | Notes |
| --- | --- | --- |
| SAThack | (unprefixed, legacy) | existing tables, do not rename |
| IELTShack | `ielts_` | all tables, RLS scoped to `auth.uid()` |
| AdmissionHack | `admission_` (recommended) | apply the same pattern when it joins |

Rules:

- Every user table carries `user_id uuid references auth.users(id)` (or `id` for
  profiles) and RLS policies scoped to `(select auth.uid())`.
- Never write a policy that trusts `authenticated` for user-owned rows.
- Community-style read-all tables (e.g. `ielts_community_posts`) may allow
  `select` to authenticated, but writes stay scoped to the author.
- Admin membership uses an app-specific table (`ielts_admins`) with no insert
  policy; admins are granted manually via SQL.
- Never expose the service-role key to a client app.

## Account lifecycle

- **Onboarding:** a profile row per app (`ielts_profiles`, `admission_profiles`),
  created by an `after insert on auth.users` trigger or on first sign-in.
- **Password / email:** shared. Changing either affects all apps.
- **Deleting app data:** each app deletes only its own rows.
  IELTShack: `ielts_delete_my_account()`.
- **Deleting the ecosystem account:** one central action only. Doing it from an
  app must warn that SAThack, AdmissionHack and IELTShack data all disappear. As
  a rule: the auth owner (SAThack) performs ecosystem account deletion; other apps
  offer "delete my data in this app".
- **Data export:** each app exports its own rows.

## Security consequences of a shared pool

An authenticated user exists for all apps, so any RLS mistake in one app exposes
data to users of another. Before adding an app:

1. Audit every policy for `auth.uid()` scoping.
2. Prefer `security definer` RPCs with explicit admin checks over broad policies.
3. Test with two accounts: one app's user must not read the other app's rows.

## Joining a new app (AdmissionHack checklist)

1. Point `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` at the shared
   project.
2. Rename its tables with the `admission_` prefix (or create them that way) and
   add RLS scoped to `auth.uid()`.
3. Add an `admission_profiles` table plus a trigger on `auth.users`, or create the
   row on first sign-in (IELTShack uses `pullRemote()` for this).
4. Move user rows from the old database:
   - match users by email against `auth.users`; create auth users only if the old
     app used plaintext/other auth (never copy passwords);
   - or force a password reset for every migrated user.
5. Add admin membership (`admission_admins`) with no insert policy.
6. Set the Supabase Auth **Site URL** and redirect allow-list to the live domains
   of all three apps.
7. Smoke test: sign up on one app, sign in on the others; confirm data separation
   with two accounts.
8. Update the shared footer/cross-links so the ecosystem is visible to users.

## Current status

- SAThack ↔ IELTShack: shared identity, isolated `ielts_` tables, verified.
- AdmissionHack: separate (its deployment is paused and no source is available in
  the repos inspected). It must be repointed and migrated to join the ecosystem.
