-- タスク5.1: event_commentsスキーマとコメント投稿・表示

create table public.event_comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id),
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.event_comments enable row level security;

create index event_comments_event_id_idx on public.event_comments (event_id);

-- event_comments: カレンダーメンバーのみ閲覧・投稿可能。投稿者は常に自分自身として記録する
create policy event_comments_select_member
  on public.event_comments
  for select
  to authenticated
  using (public.is_event_calendar_member(event_id, auth.uid()));

create policy event_comments_insert_member
  on public.event_comments
  for insert
  to authenticated
  with check (
    public.is_event_calendar_member(event_id, auth.uid())
    and user_id = auth.uid()
  );
