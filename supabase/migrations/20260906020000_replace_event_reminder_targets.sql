-- event_reminder_targets(対象者選択)はevent_remindersに置き換えられ不要になったため廃止する。
drop table if exists public.event_reminder_targets;

-- notification_log: event_remindersは1予定につきユーザーごと複数件(当日/1日前など)持てるため、
-- 予定単位(event_id)ではなくevent_reminder単位で冪等性キーを取る必要がある。
-- (event_idは既存のevent-change-notifier等、他の通知種別の冪等性キーとして引き続き使うため、
--  event_reminder系の通知ではevent_idを設定せずevent_reminder_idのみを設定する運用とする)
alter table public.notification_log
  add column event_reminder_id uuid references public.event_reminders (id) on delete cascade;

create unique index notification_log_event_reminder_idempotency_key
  on public.notification_log (target_user_id, event_reminder_id)
  where event_reminder_id is not null;

-- カレンダーから抜けた際、そのカレンダー配下の予定に対する自分のリマインド設定も削除する
-- (残すとRLSで自分からは見えなくなる一方、配信はservice roleがRLSを無視して行うため、
--  抜けたはずのカレンダーの予定について通知され続けてしまう)
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
    delete from public.event_reminders
    where user_id = auth.uid()
      and event_id in (select id from public.events where calendar_id = p_calendar_id);
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
