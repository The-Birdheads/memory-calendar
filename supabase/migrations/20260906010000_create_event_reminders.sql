-- 予定のリマインド機能刷新: 「誰に通知するか(対象者)」ではなく、各メンバーが
-- 自分自身のリマインド時刻を自由に選べる個人設定(event_reminders)に置き換える。
-- 終日予定: 当日/1日前/2日前(JST 9時に通知) + カスタム時刻
-- 時刻指定の予定: 開始時/10分前/1時間前 + カスタム時刻
-- (event_reminder_targetsの廃止とnotification_log側の対応は次のマイグレーションで行う)

-- kind(カスタム以外)から実際の通知時刻を計算する。予定のstart_atが変わった場合に
-- 再計算できるよう、トリガーからも呼び出せる独立した関数として定義する。
create or replace function public.compute_event_reminder_at(
  p_kind text,
  p_custom_at timestamptz,
  p_start_at timestamptz
) returns timestamptz
language sql
stable
as $$
  select case p_kind
    when 'custom' then p_custom_at
    when 'on_day' then ((p_start_at at time zone 'Asia/Tokyo')::date::text || ' 09:00:00')::timestamp at time zone 'Asia/Tokyo'
    when 'day_before_1' then (((p_start_at at time zone 'Asia/Tokyo')::date - 1)::text || ' 09:00:00')::timestamp at time zone 'Asia/Tokyo'
    when 'day_before_2' then (((p_start_at at time zone 'Asia/Tokyo')::date - 2)::text || ' 09:00:00')::timestamp at time zone 'Asia/Tokyo'
    when 'at_start' then p_start_at
    when 'before_10m' then p_start_at - interval '10 minutes'
    when 'before_1h' then p_start_at - interval '1 hour'
    else null
  end;
$$;

revoke all on function public.compute_event_reminder_at(text, timestamptz, timestamptz) from public;
grant execute on function public.compute_event_reminder_at(text, timestamptz, timestamptz) to anon, authenticated;

create table public.event_reminders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('on_day', 'day_before_1', 'day_before_2', 'at_start', 'before_10m', 'before_1h', 'custom')),
  custom_at timestamptz,
  remind_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint event_reminders_custom_at_matches_kind check (
    (kind = 'custom' and custom_at is not null) or (kind <> 'custom' and custom_at is null)
  )
);

-- 「当日」等の定型リマインドはユーザーごとに1件まで、カスタムも1件まで
-- (部分一意インデックス2本で表現: NULL同士は非等価とみなされるPostgresの挙動を避けるため)
create unique index event_reminders_unique_non_custom
  on public.event_reminders (event_id, user_id, kind)
  where kind <> 'custom';

create unique index event_reminders_unique_custom
  on public.event_reminders (event_id, user_id)
  where kind = 'custom';

create index event_reminders_remind_at_idx on public.event_reminders (remind_at);

-- remind_atはクライアントから渡さず、常にkind/custom_at/予定のstart_atから計算する。
create or replace function public.set_event_reminder_remind_at()
returns trigger
language plpgsql
as $$
declare
  v_start_at timestamptz;
begin
  select start_at into v_start_at from public.events where id = new.event_id;
  new.remind_at := public.compute_event_reminder_at(new.kind, new.custom_at, v_start_at);
  return new;
end;
$$;

create trigger event_reminders_set_remind_at
  before insert or update on public.event_reminders
  for each row execute function public.set_event_reminder_remind_at();

-- 予定の開始日時が変わったら、カスタム以外(相対指定)のリマインドを再計算する。
create or replace function public.recompute_event_reminders_on_event_start_change()
returns trigger
language plpgsql
as $$
begin
  if new.start_at is distinct from old.start_at then
    update public.event_reminders
    set remind_at = public.compute_event_reminder_at(kind, custom_at, new.start_at)
    where event_id = new.id and kind <> 'custom';
  end if;
  return new;
end;
$$;

create trigger events_recompute_reminders_on_start_change
  after update of start_at on public.events
  for each row execute function public.recompute_event_reminders_on_event_start_change();

alter table public.event_reminders enable row level security;

-- 完全に個人設定: 自分の行のみ閲覧・登録・削除できる(他人のリマインドは見えず、設定もできない)
create policy event_reminders_select_own
  on public.event_reminders
  for select
  to authenticated
  using (user_id = auth.uid() and public.is_event_calendar_member(event_id, auth.uid()));

create policy event_reminders_insert_own
  on public.event_reminders
  for insert
  to authenticated
  with check (user_id = auth.uid() and public.is_event_calendar_member(event_id, auth.uid()));

create policy event_reminders_delete_own
  on public.event_reminders
  for delete
  to authenticated
  using (user_id = auth.uid());
