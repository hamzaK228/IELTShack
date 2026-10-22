-- IELTShack schema, hosted in the existing ecosystem Supabase project.
--
-- The project is shared with SAThack, so every object is prefixed with
-- `ielts_` and no existing table, function, policy, or trigger is touched.
-- It is safe to re-run (create if not exists / drop policy if exists).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.ielts_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table if not exists public.ielts_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  target_band numeric(2, 1) not null default 7.5,
  current_band numeric(2, 1),
  test_date date,
  hours_per_week integer not null default 8,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ielts_profiles enable row level security;

drop policy if exists "ielts_profiles_select_own" on public.ielts_profiles;
create policy "ielts_profiles_select_own" on public.ielts_profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "ielts_profiles_insert_own" on public.ielts_profiles;
create policy "ielts_profiles_insert_own" on public.ielts_profiles
  for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists "ielts_profiles_update_own" on public.ielts_profiles;
create policy "ielts_profiles_update_own" on public.ielts_profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop trigger if exists ielts_profiles_updated_at on public.ielts_profiles;
create trigger ielts_profiles_updated_at before update on public.ielts_profiles
  for each row execute function public.ielts_set_updated_at();

create or replace function public.ielts_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ielts_profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists ielts_on_auth_user_created on auth.users;
create trigger ielts_on_auth_user_created
  after insert on auth.users
  for each row execute function public.ielts_handle_new_user();

-- ---------------------------------------------------------------------------
-- Attempts
-- ---------------------------------------------------------------------------

create table if not exists public.ielts_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  test_id text not null,
  test_title text not null,
  mode text not null check (mode in ('exam', 'practice')),
  started_at timestamptz,
  finished_at timestamptz not null default now(),
  duration_seconds integer not null default 0,
  answers jsonb not null default '{}'::jsonb,
  per_skill jsonb not null default '{}'::jsonb,
  overall_band numeric(2, 1) not null default 0,
  correct integer not null default 0,
  total integer not null default 0,
  missed jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ielts_attempts_user_finished_idx
  on public.ielts_attempts (user_id, finished_at desc);

alter table public.ielts_attempts enable row level security;

drop policy if exists "ielts_attempts_select_own" on public.ielts_attempts;
create policy "ielts_attempts_select_own" on public.ielts_attempts
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "ielts_attempts_insert_own" on public.ielts_attempts;
create policy "ielts_attempts_insert_own" on public.ielts_attempts
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "ielts_attempts_delete_own" on public.ielts_attempts;
create policy "ielts_attempts_delete_own" on public.ielts_attempts
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Saved questions
-- ---------------------------------------------------------------------------

create table if not exists public.ielts_saved_questions (
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

alter table public.ielts_saved_questions enable row level security;

drop policy if exists "ielts_saved_select_own" on public.ielts_saved_questions;
create policy "ielts_saved_select_own" on public.ielts_saved_questions
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "ielts_saved_insert_own" on public.ielts_saved_questions;
create policy "ielts_saved_insert_own" on public.ielts_saved_questions
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "ielts_saved_delete_own" on public.ielts_saved_questions;
create policy "ielts_saved_delete_own" on public.ielts_saved_questions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Vocabulary progress
-- ---------------------------------------------------------------------------

create table if not exists public.ielts_vocab_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  word text not null,
  known boolean not null default false,
  seen integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, word)
);

alter table public.ielts_vocab_progress enable row level security;

drop policy if exists "ielts_vocab_all_own" on public.ielts_vocab_progress;
create policy "ielts_vocab_all_own" on public.ielts_vocab_progress
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Plan checklist
-- ---------------------------------------------------------------------------

create table if not exists public.ielts_plan_tasks (
  user_id uuid not null references auth.users (id) on delete cascade,
  task_key text not null,
  done boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, task_key)
);

alter table public.ielts_plan_tasks enable row level security;

drop policy if exists "ielts_plan_all_own" on public.ielts_plan_tasks;
create policy "ielts_plan_all_own" on public.ielts_plan_tasks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Writing drafts
-- ---------------------------------------------------------------------------

create table if not exists public.ielts_writing_drafts (
  user_id uuid not null references auth.users (id) on delete cascade,
  prompt_id text not null,
  text text not null default '',
  checklist jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, prompt_id)
);

alter table public.ielts_writing_drafts enable row level security;

drop policy if exists "ielts_writing_all_own" on public.ielts_writing_drafts;
create policy "ielts_writing_all_own" on public.ielts_writing_drafts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Speaking self-ratings
-- ---------------------------------------------------------------------------

create table if not exists public.ielts_speaking_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  prompt_id text not null,
  scores jsonb not null default '{}'::jsonb,
  overall numeric(2, 1) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ielts_speaking_user_idx
  on public.ielts_speaking_ratings (user_id, created_at desc);

alter table public.ielts_speaking_ratings enable row level security;

drop policy if exists "ielts_speaking_all_own" on public.ielts_speaking_ratings;
create policy "ielts_speaking_all_own" on public.ielts_speaking_ratings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Community
-- ---------------------------------------------------------------------------

create table if not exists public.ielts_community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  author text not null,
  body text not null check (char_length(body) between 1 and 2000),
  likes integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ielts_community_created_idx
  on public.ielts_community_posts (created_at desc);

alter table public.ielts_community_posts enable row level security;

drop policy if exists "ielts_community_read" on public.ielts_community_posts;
create policy "ielts_community_read" on public.ielts_community_posts
  for select to authenticated using (true);

drop policy if exists "ielts_community_insert_own" on public.ielts_community_posts;
create policy "ielts_community_insert_own" on public.ielts_community_posts
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "ielts_community_update_own" on public.ielts_community_posts;
create policy "ielts_community_update_own" on public.ielts_community_posts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "ielts_community_delete_own" on public.ielts_community_posts;
create policy "ielts_community_delete_own" on public.ielts_community_posts
  for delete to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.ielts_post_likes (
  post_id uuid not null references public.ielts_community_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.ielts_post_likes enable row level security;

drop policy if exists "ielts_post_likes_read" on public.ielts_post_likes;
create policy "ielts_post_likes_read" on public.ielts_post_likes
  for select to authenticated using (true);

drop policy if exists "ielts_post_likes_insert_own" on public.ielts_post_likes;
create policy "ielts_post_likes_insert_own" on public.ielts_post_likes
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "ielts_post_likes_delete_own" on public.ielts_post_likes;
create policy "ielts_post_likes_delete_own" on public.ielts_post_likes
  for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.ielts_sync_post_likes()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    update public.ielts_community_posts set likes = likes + 1 where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.ielts_community_posts set likes = greatest(likes - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists ielts_post_likes_sync on public.ielts_post_likes;
create trigger ielts_post_likes_sync
  after insert or delete on public.ielts_post_likes
  for each row execute function public.ielts_sync_post_likes();
