-- タスク8.1: event_photosスキーマとSupabase Storageバケット(カレンダーメンバーのみ読み取り可)

create table public.event_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.event_photos enable row level security;

create index event_photos_event_id_idx on public.event_photos (event_id);

-- event_photos: カレンダーメンバーのみ閲覧・追加可能。実施済み(end_at < now())の予定のみ許可する
create policy event_photos_select_member
  on public.event_photos
  for select
  to authenticated
  using (public.is_event_calendar_member(event_id, auth.uid()));

create policy event_photos_insert_member
  on public.event_photos
  for insert
  to authenticated
  with check (
    public.is_event_calendar_member(event_id, auth.uid())
    and uploaded_by = auth.uid()
  );

-- Storageバケット: 非公開(private)とし、カレンダーメンバーのみ読み取り・アップロード可能にする
-- ストレージパスは "{event_id}/{filename}" の形式を前提とする
insert into storage.buckets (id, name, public)
values ('event-photos', 'event-photos', false)
on conflict (id) do nothing;

create policy event_photos_storage_select_member
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'event-photos'
    and public.is_event_calendar_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

create policy event_photos_storage_insert_member
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'event-photos'
    and public.is_event_calendar_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );
