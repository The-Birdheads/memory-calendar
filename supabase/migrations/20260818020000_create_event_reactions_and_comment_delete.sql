-- タスク5.2: event_reactionsスキーマ(スタンプ付与)と、自分のコメントの削除

create table public.event_reactions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id),
  stamp_type text not null,
  created_at timestamptz not null default now()
);

alter table public.event_reactions enable row level security;

create index event_reactions_event_id_idx on public.event_reactions (event_id);

-- event_reactions: カレンダーメンバーのみ閲覧・付与可能。付与者は常に自分自身として記録する
create policy event_reactions_select_member
  on public.event_reactions
  for select
  to authenticated
  using (public.is_event_calendar_member(event_id, auth.uid()));

create policy event_reactions_insert_member
  on public.event_reactions
  for insert
  to authenticated
  with check (
    public.is_event_calendar_member(event_id, auth.uid())
    and user_id = auth.uid()
  );

-- event_comments: 自分が投稿したコメントのみ削除できる(5.4)
create policy event_comments_delete_own
  on public.event_comments
  for delete
  to authenticated
  using (user_id = auth.uid());
