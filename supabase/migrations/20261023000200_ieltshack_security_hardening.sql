-- Security hardening: AI quota, community-like counter, and the app-deletion
-- function extended to the new usage table.

create table if not exists public.ielts_ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  used integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.ielts_ai_usage enable row level security;

-- Likes are only read for the current user (the UI already queries only own
-- rows); do not expose every user's likes to the whole ecosystem.
drop policy if exists "ielts_post_likes_read" on public.ielts_post_likes;
create policy "ielts_post_likes_read" on public.ielts_post_likes
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "ielts_ai_usage_select_own" on public.ielts_ai_usage;
create policy "ielts_ai_usage_select_own" on public.ielts_ai_usage
  for select to authenticated using ((select auth.uid()) = user_id);

-- No insert/update policy: the security-definer RPC below is the only writer.

create table if not exists public.ielts_content_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  test_id text not null,
  question_id text not null,
  reason text not null check (char_length(reason) between 1 and 1000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  unique (user_id, question_id)
);

alter table public.ielts_content_reports enable row level security;

drop policy if exists "ielts_content_reports_insert_own" on public.ielts_content_reports;
create policy "ielts_content_reports_insert_own" on public.ielts_content_reports
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "ielts_content_reports_select_own" on public.ielts_content_reports;
create policy "ielts_content_reports_select_own" on public.ielts_content_reports
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "ielts_content_reports_update_own" on public.ielts_content_reports;
create policy "ielts_content_reports_update_own" on public.ielts_content_reports
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.ielts_review_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id text not null,
  reviewed_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

alter table public.ielts_review_items enable row level security;

drop policy if exists "ielts_review_items_all_own" on public.ielts_review_items;
create policy "ielts_review_items_all_own" on public.ielts_review_items
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.ielts_consume_ai_quota(p_limit integer default 40)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  used_now integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_limit is null or p_limit < 1 then
    raise exception 'invalid limit';
  end if;

  insert into public.ielts_ai_usage (user_id, day, used)
  values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update
    set used = public.ielts_ai_usage.used + 1,
        updated_at = now()
  returning used into used_now;

  return p_limit - used_now;
end;
$$;

revoke all on function public.ielts_consume_ai_quota(integer) from public;
grant execute on function public.ielts_consume_ai_quota(integer) to authenticated;

create or replace function public.ielts_admin_reports()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ielts_is_admin() then
    raise exception 'not authorized';
  end if;
  return coalesce(
    (select jsonb_agg(
       jsonb_build_object(
         'id', id,
         'test_id', test_id,
         'question_id', question_id,
         'reason', reason,
         'created_at', created_at
       ) order by created_at desc
     )
     from public.ielts_content_reports
     where status = 'open'),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.ielts_admin_reports() from public;
grant execute on function public.ielts_admin_reports() to authenticated;

create or replace function public.ielts_admin_resolve_report(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ielts_is_admin() then
    raise exception 'not authorized';
  end if;
  update public.ielts_content_reports
    set status = 'resolved'
    where id = target;
end;
$$;

revoke all on function public.ielts_admin_resolve_report(uuid) from public;
grant execute on function public.ielts_admin_resolve_report(uuid) to authenticated;

-- No edit UI exists: removing the author-update policy stops a client from
-- rewriting the denormalised `likes` count (or author) directly. The
-- security-definer trigger below still maintains the counter.
drop policy if exists "ielts_community_update_own" on public.ielts_community_posts;

-- The original trigger ran as the liking user, so the RLS update policy on
-- ielts_community_posts (author only) blocked counter updates on other people's
-- posts. Run the counter as the definer with a fixed search_path.
create or replace function public.ielts_sync_post_likes()
returns trigger
language plpgsql
security definer
set search_path = public
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

create or replace function public.ielts_delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  delete from public.ielts_attempts where user_id = caller;
  delete from public.ielts_saved_questions where user_id = caller;
  delete from public.ielts_vocab_progress where user_id = caller;
  delete from public.ielts_plan_tasks where user_id = caller;
  delete from public.ielts_writing_drafts where user_id = caller;
  delete from public.ielts_speaking_ratings where user_id = caller;
  delete from public.ielts_community_posts where user_id = caller;
  delete from public.ielts_post_likes where user_id = caller;
  delete from public.ielts_ai_usage where user_id = caller;
  delete from public.ielts_review_items where user_id = caller;
  delete from public.ielts_content_reports where user_id = caller;
  delete from public.ielts_admins where user_id = caller;
  delete from public.ielts_profiles where id = caller;
end;
$$;

revoke all on function public.ielts_delete_my_account() from public;
grant execute on function public.ielts_delete_my_account() to authenticated;

-- Supabase grants EXECUTE to anon by default; the checks above already reject
-- anonymous callers, but there is no reason to expose the endpoints at all.
revoke all on function public.ielts_admin_delete_post(uuid) from anon;
revoke all on function public.ielts_admin_stats() from anon;
revoke all on function public.ielts_admin_reports() from anon;
revoke all on function public.ielts_admin_resolve_report(uuid) from anon;
revoke all on function public.ielts_consume_ai_quota(integer) from anon;
revoke all on function public.ielts_delete_my_account() from anon;
revoke all on function public.ielts_is_admin() from anon;
revoke all on function public.ielts_handle_new_user() from anon;
revoke all on function public.ielts_set_updated_at() from anon;
revoke all on function public.ielts_sync_post_likes() from anon;
