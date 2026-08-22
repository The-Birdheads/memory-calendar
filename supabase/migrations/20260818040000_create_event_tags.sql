-- タスク6.2: event_tagsスキーマ(予定への複数タグ付与)

create table public.event_tags (
  event_id uuid not null references public.events (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (event_id, tag_id)
);

alter table public.event_tags enable row level security;

create index event_tags_tag_id_idx on public.event_tags (tag_id);

-- event_tags: calendar_idを直接持たないためevent_id経由でメンバーシップを判定する
create policy event_tags_select_member
  on public.event_tags
  for select
  to authenticated
  using (public.is_event_calendar_member(event_id, auth.uid()));

create policy event_tags_insert_member
  on public.event_tags
  for insert
  to authenticated
  with check (public.is_event_calendar_member(event_id, auth.uid()));
