-- タスク10.1: meal_records/meal_tagsスキーマと区分別登録

create table public.meal_records (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  meal_date date not null,
  slot text not null check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  title text not null,
  rating integer check (rating between 1 and 5),
  url text,
  memo text,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.meal_records enable row level security;

create index meal_records_calendar_id_meal_date_idx on public.meal_records (calendar_id, meal_date);

create trigger set_meal_records_updated_at
  before update on public.meal_records
  for each row execute function public.set_current_timestamp_updated_at();

create policy meal_records_select_member
  on public.meal_records
  for select
  to authenticated
  using (public.is_calendar_member(calendar_id, auth.uid()));

create policy meal_records_insert_member
  on public.meal_records
  for insert
  to authenticated
  with check (public.is_calendar_member(calendar_id, auth.uid()));

-- meal_tags: 予定用のtagsテーブルとは完全に独立したフラットなタグ分類(自炊・外食・洋食・和食など)
create table public.meal_tags (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.meal_tags enable row level security;

create policy meal_tags_select_member
  on public.meal_tags
  for select
  to authenticated
  using (public.is_calendar_member(calendar_id, auth.uid()));

create policy meal_tags_insert_member
  on public.meal_tags
  for insert
  to authenticated
  with check (public.is_calendar_member(calendar_id, auth.uid()));

-- meal_record_tags: 献立記録とmeal_tagsの多対多。tagsテーブルへの参照は持たない(要件12.3)
create table public.meal_record_tags (
  meal_record_id uuid not null references public.meal_records (id) on delete cascade,
  meal_tag_id uuid not null references public.meal_tags (id) on delete cascade,
  primary key (meal_record_id, meal_tag_id)
);

alter table public.meal_record_tags enable row level security;

create index meal_record_tags_meal_tag_id_idx on public.meal_record_tags (meal_tag_id);

-- meal_record_tags: calendar_idを直接持たないためmeal_record_id経由でメンバーシップを判定する
create or replace function public.is_meal_record_calendar_member(p_meal_record_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1
    from public.meal_records mr
    where mr.id = p_meal_record_id
      and public.is_calendar_member(mr.calendar_id, p_user_id)
  );
end;
$$;

revoke all on function public.is_meal_record_calendar_member(uuid, uuid) from public;
grant execute on function public.is_meal_record_calendar_member(uuid, uuid) to anon, authenticated;

create policy meal_record_tags_select_member
  on public.meal_record_tags
  for select
  to authenticated
  using (public.is_meal_record_calendar_member(meal_record_id, auth.uid()));

create policy meal_record_tags_insert_member
  on public.meal_record_tags
  for insert
  to authenticated
  with check (public.is_meal_record_calendar_member(meal_record_id, auth.uid()));
