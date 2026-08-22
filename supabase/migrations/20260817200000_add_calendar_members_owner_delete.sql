-- タスク3.3: オーナーによるメンバー削除を許可するRLSポリシー

create or replace function public.is_calendar_owner(p_calendar_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1
    from public.calendar_members cm
    where cm.calendar_id = p_calendar_id
      and cm.user_id = p_user_id
      and cm.role = 'owner'
  );
end;
$$;

revoke all on function public.is_calendar_owner(uuid, uuid) from public;
grant execute on function public.is_calendar_owner(uuid, uuid) to anon, authenticated;

create policy calendar_members_delete_owner
  on public.calendar_members
  for delete
  to authenticated
  using (public.is_calendar_owner(calendar_id, auth.uid()));
