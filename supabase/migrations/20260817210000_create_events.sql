-- タスク4.1: eventsスキーマと単発予定の登録

create table public.events (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  title text not null,
  location text,
  memo text,
  category_color text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  is_all_day boolean not null default false,
  reminder_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles (id),
  updated_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at >= start_at)
);

alter table public.events enable row level security;

create index events_calendar_id_start_at_idx on public.events (calendar_id, start_at);

create trigger set_events_updated_at
  before update on public.events
  for each row execute function public.set_current_timestamp_updated_at();

-- events: カレンダーメンバーのみ閲覧・登録可能。作成者・最終更新者は常に自分自身として記録する
create policy events_select_member
  on public.events
  for select
  to authenticated
  using (public.is_calendar_member(calendar_id, auth.uid()));

create policy events_insert_member
  on public.events
  for insert
  to authenticated
  with check (
    public.is_calendar_member(calendar_id, auth.uid())
    and created_by = auth.uid()
    and updated_by = auth.uid()
  );
