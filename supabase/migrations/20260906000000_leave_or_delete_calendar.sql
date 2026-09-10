-- グループカレンダーの削除/退出(RPC leave_or_delete_calendar)
-- 個人用カレンダーは対象外。他にメンバーがいれば呼び出し元だけ抜け、自分のみの
-- 場合はカレンダー自体を削除する(events等はon delete cascadeで自動的に削除される)。
-- calendarsに対するDELETEのRLSポリシーは存在しないため、SECURITY DEFINERで実装する。
create or replace function public.leave_or_delete_calendar(p_calendar_id uuid)
returns boolean -- true: カレンダー自体を削除した / false: 自分だけ抜けた
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_is_member boolean;
  v_member_count int;
begin
  select kind into v_kind
  from public.calendars
  where id = p_calendar_id;

  if not found then
    raise exception 'calendar_not_found' using errcode = 'A0001';
  end if;

  if v_kind = 'personal' then
    raise exception 'cannot_delete_personal_calendar';
  end if;

  select exists (
    select 1 from public.calendar_members
    where calendar_id = p_calendar_id and user_id = auth.uid()
  ) into v_is_member;

  if not v_is_member then
    raise exception 'not_a_member';
  end if;

  select count(*) into v_member_count
  from public.calendar_members
  where calendar_id = p_calendar_id;

  if v_member_count > 1 then
    delete from public.calendar_members
    where calendar_id = p_calendar_id and user_id = auth.uid();
    return false;
  else
    delete from public.calendars where id = p_calendar_id;
    return true;
  end if;
end;
$$;

revoke all on function public.leave_or_delete_calendar(uuid) from public;
grant execute on function public.leave_or_delete_calendar(uuid) to authenticated;
