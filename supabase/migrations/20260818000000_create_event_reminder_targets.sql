-- タスク4.6: 予定のリマインダー対象者(event_reminder_targets)

-- event_idを介してカレンダーメンバーかどうかを判定するヘルパー。
-- calendar_idを直接持たない予定の子テーブル(event_reminder_targets等)のRLSで再利用する。
create or replace function public.is_event_calendar_member(p_event_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and public.is_calendar_member(e.calendar_id, p_user_id)
  );
end;
$$;

revoke all on function public.is_event_calendar_member(uuid, uuid) from public;
grant execute on function public.is_event_calendar_member(uuid, uuid) to anon, authenticated;

-- event_reminder_targets: 行が存在しない予定は「全メンバー」を対象とみなす(設計上の既定値)
create table public.event_reminder_targets (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (event_id, user_id)
);

alter table public.event_reminder_targets enable row level security;

create index event_reminder_targets_event_id_idx on public.event_reminder_targets (event_id);

create policy event_reminder_targets_select_member
  on public.event_reminder_targets
  for select
  to authenticated
  using (public.is_event_calendar_member(event_id, auth.uid()));

create policy event_reminder_targets_insert_member
  on public.event_reminder_targets
  for insert
  to authenticated
  with check (public.is_event_calendar_member(event_id, auth.uid()));

create policy event_reminder_targets_delete_member
  on public.event_reminder_targets
  for delete
  to authenticated
  using (public.is_event_calendar_member(event_id, auth.uid()));
