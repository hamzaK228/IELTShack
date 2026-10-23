-- Fix app-data deletion: never delete the shared ecosystem identity.
--
-- The first version of ielts_delete_my_account() deleted from auth.users.
-- That is the shared SAThack/IELTShack/AdmissionHack identity, and deleting it
-- either cascades into other apps' rows or fails on their foreign keys. This
-- replacement deletes only IELTShack rows owned by the caller.

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
  delete from public.ielts_admins where user_id = caller;
  delete from public.ielts_profiles where id = caller;
end;
$$;

revoke all on function public.ielts_delete_my_account() from public;
grant execute on function public.ielts_delete_my_account() to authenticated;
