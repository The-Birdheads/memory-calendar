-- タスク4.3: 繰り返しシリーズの生成(終了日必須・最大1年)

create table public.event_series (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  recurrence_rule text not null check (recurrence_rule in ('daily', 'weekly', 'monthly')),
  start_at timestamptz not null,
  recurrence_end_at timestamptz not null,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  check (recurrence_end_at >= start_at),
  check (recurrence_end_at - start_at <= interval '365 days')
);

alter table public.event_series enable row level security;

-- event_series はカレンダーメンバーのみ閲覧可能。書き込みはcreate_recurring_series RPC(SECURITY DEFINER)経由に限定する
create policy event_series_select_member
  on public.event_series
  for select
  to authenticated
  using (public.is_calendar_member(calendar_id, auth.uid()));

-- events: 繰り返しの各回を紐づけるseries_id列を追加する(単発予定はnull)
alter table public.events
  add column series_id uuid references public.event_series (id) on delete cascade;

create index events_series_id_idx on public.events (series_id);

-- 同一シリーズ内で開始日時が重複する回の生成を防止する(単発予定はseries_idがnullのため対象外)
alter table public.events
  add constraint events_series_id_start_at_key unique (series_id, start_at);

-- 開始日から終了日までの各回をeventsへ個別行として生成し、共通のseries_idで紐づけるRPC。
-- 呼び出しユーザーがカレンダーメンバーであることを検証したうえでSECURITY DEFINERとして実行する。
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

  return query select * from public.events where series_id = v_series_id order by start_at;
end;
$$;

revoke all on function public.create_recurring_series(
  uuid, text, timestamptz, timestamptz, text, timestamptz, boolean, text, text, text, timestamptz
) from public;
grant execute on function public.create_recurring_series(
  uuid, text, timestamptz, timestamptz, text, timestamptz, boolean, text, text, text, timestamptz
) to authenticated;
