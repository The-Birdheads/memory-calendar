-- タスク3.1: calendars/calendar_members スキーマとカレンダー作成

create table public.calendars (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.calendars enable row level security;

create table public.calendar_members (
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (calendar_id, user_id)
);

alter table public.calendar_members enable row level security;

create index calendar_members_user_id_idx on public.calendar_members (user_id);

-- calendars: カレンダーメンバーのみ閲覧可能。作成は本人がcreated_byとして登録する場合のみ許可する
create policy calendars_select_member
  on public.calendars
  for select
  to authenticated
  using (public.is_calendar_member(id, auth.uid()));

create policy calendars_insert_own
  on public.calendars
  for insert
  to authenticated
  with check (created_by = auth.uid());

-- calendar_members: メンバー本人たちのみ閲覧可能。書き込みはSECURITY DEFINER経由(トリガー・招待/削除RPC)に限定し、
-- クライアントからの直接INSERT/UPDATE/DELETEは許可しない(招待経由の参加は3.2、メンバー削除は3.3で追加する)
create policy calendar_members_select_member
  on public.calendar_members
  for select
  to authenticated
  using (public.is_calendar_member(calendar_id, auth.uid()));

-- カレンダー作成時に、作成者をownerとしてcalendar_membersへ自動登録する
create or replace function public.handle_new_calendar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.calendar_members (calendar_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger on_calendar_created
  after insert on public.calendars
  for each row execute function public.handle_new_calendar();
