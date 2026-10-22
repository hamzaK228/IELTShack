-- Admin roles, account deletion, and admin RPCs for IELTShack.
-- Admin membership is granted only through the SQL editor / service role:
-- there is no insert policy, so a signed-in user cannot promote themselves.

create table if not exists public.ielts_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.ielts_admins enable row level security;

drop policy if exists "ielts_admins_select_own" on public.ielts_admins;
create policy "ielts_admins_select_own" on public.ielts_admins
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.ielts_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.ielts_admins where user_id = auth.uid());
$$;

revoke all on function public.ielts_is_admin() from public;
grant execute on function public.ielts_is_admin() to authenticated;

create or replace function public.ielts_delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.ielts_delete_my_account() from public;
grant execute on function public.ielts_delete_my_account() to authenticated;

create or replace function public.ielts_admin_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ielts_is_admin() then
    raise exception 'not authorized';
  end if;
  return jsonb_build_object(
    'profiles', (select count(*) from public.ielts_profiles),
    'attempts', (select count(*) from public.ielts_attempts),
    'posts', (select count(*) from public.ielts_community_posts),
    'ratings', (select count(*) from public.ielts_speaking_ratings),
    'drafts', (select count(*) from public.ielts_writing_drafts),
    'plan_tasks', (select count(*) from public.ielts_plan_tasks)
  );
end;
$$;

revoke all on function public.ielts_admin_stats() from public;
grant execute on function public.ielts_admin_stats() to authenticated;

create or replace function public.ielts_admin_delete_post(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.ielts_is_admin() then
    raise exception 'not authorized';
  end if;
  delete from public.ielts_community_posts where id = target;
end;
$$;

revoke all on function public.ielts_admin_delete_post(uuid) from public;
grant execute on function public.ielts_admin_delete_post(uuid) to authenticated;
