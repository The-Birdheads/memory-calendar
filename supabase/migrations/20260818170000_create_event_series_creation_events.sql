-- タスク11.3: 繰り返しシリーズ作成の集約通知

create table public.event_series_creation_events (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.event_series (id) on delete cascade,
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles (id),
  event_count integer not null,
  created_at timestamptz not null default now()
);

-- クライアントからの直接書き込みは行わない(create_recurring_series RPC経由のみ)。
-- 閲覧はカレンダーメンバーに許可する(将来的な監査・履歴表示用途)。
alter table public.event_series_creation_events enable row level security;

create policy event_series_creation_events_select_member
  on public.event_series_creation_events
  for select
  to authenticated
  using (public.is_calendar_member(calendar_id, auth.uid()));

-- notification_log: event_series_creation_events起点の通知はseries_idを対象キーとして扱う(6.1)。
-- event_idカラムはevents(id)へのFKであり、series_idとは型は同じでも参照先テーブルが異なるため
-- 専用のseries_id列を追加し、部分一意インデックスで冪等性を担保する。
alter table public.notification_log
  add column series_id uuid references public.event_series (id) on delete cascade;

create unique index notification_log_series_idempotency_key
  on public.notification_log (type, target_user_id, series_id)
  where series_id is not null;

-- create_recurring_series: シリーズ生成後にevent_series_creation_eventsへ1件INSERTする。
-- (タスク4.3で定義した関数をCREATE OR REPLACEで置き換える。個々のevents行のINSERTに対する
-- event_change_notifier_on_event_insertトリガーは、series_idが設定されているため発火しない。)
create or replace function public.create_recurring_series(
  p_calendar_id uuid,
  p_title text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_recurrence_rule text,
  p_recurrence_end_at timestamptz,
  p_is_all_day boolean default false,
  p_location text default null,
  p_memo text default null,
  p_category_color text default null,
  p_reminder_at timestamptz default null
)
returns setof public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_series_id uuid;
  v_step interval;
  v_duration interval;
  v_occurrence_start timestamptz;
  v_event_count integer;
begin
  if not public.is_calendar_member(p_calendar_id, auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_recurrence_end_at is null then
    raise exception 'recurrence_end_at is required' using errcode = 'A0003';
  end if;

  if p_recurrence_end_at - p_start_at > interval '365 days' then
    raise exception 'recurrence_end_at must be within 1 year of start_at' using errcode = 'A0003';
  end if;

  v_step := case p_recurrence_rule
    when 'daily' then interval '1 day'
    when 'weekly' then interval '1 week'
    when 'monthly' then interval '1 month'
  end;
  v_duration := p_end_at - p_start_at;

  insert into public.event_series (calendar_id, recurrence_rule, start_at, recurrence_end_at, created_by)
  values (p_calendar_id, p_recurrence_rule, p_start_at, p_recurrence_end_at, auth.uid())
  returning id into v_series_id;

  v_occurrence_start := p_start_at;
  while v_occurrence_start <= p_recurrence_end_at loop
    insert into public.events (
      calendar_id, series_id, title, location, memo, category_color,
      start_at, end_at, is_all_day, reminder_at, created_by, updated_by
    ) values (
      p_calendar_id, v_series_id, p_title, p_location, p_memo, p_category_color,
      v_occurrence_start, v_occurrence_start + v_duration, p_is_all_day, p_reminder_at,
      auth.uid(), auth.uid()
    );
    v_occurrence_start := v_occurrence_start + v_step;
  end loop;

  select count(*) into v_event_count from public.events where series_id = v_series_id;

  insert into public.event_series_creation_events (series_id, calendar_id, created_by, event_count)
  values (v_series_id, p_calendar_id, auth.uid(), v_event_count);

  return query select * from public.events where series_id = v_series_id order by start_at;
end;
$$;

-- DB Webhook: event_series_creation_eventsのINSERTを起点に集約通知を送信する
create trigger event_change_notifier_on_series_creation
  after insert on public.event_series_creation_events
  for each row
  execute function supabase_functions.http_request(
    'http://host.docker.internal:54321/functions/v1/event-change-notifier',
    'POST',
    '{"Content-Type":"application/json"}',
    '{}',
    '5000'
  );
