-- タスク15.1: タグをカレンダー所有からユーザー所有へ移行する

alter table public.tags add column user_id uuid references public.profiles (id);

-- 既存タグの移行: 本番相当データは存在しないため、所属カレンダーの作成者を暫定的な所有者とみなす
-- (design.md Migration Strategyを参照)
update public.tags t
set user_id = c.created_by
from public.calendars c
where c.id = t.calendar_id;

alter table public.tags
  alter column user_id set default auth.uid(),
  alter column user_id set not null;

-- 既存ポリシーはcalendar_id列に依存しているため、列を削除する前に先に削除する
drop policy tags_select_member on public.tags;
drop policy tags_insert_member on public.tags;
drop policy tags_update_member on public.tags;
drop policy tags_delete_member on public.tags;

drop index if exists tags_calendar_id_parent_id_idx;
alter table public.tags drop column calendar_id;

create index tags_user_id_parent_id_idx on public.tags (user_id, parent_id);

-- RLS: 作成者本人のみが閲覧・作成・更新・削除できる。カレンダーメンバーシップは一切参照しない(要件10.9, 10.10)
create policy tags_select_own
  on public.tags
  for select
  to authenticated
  using (user_id = auth.uid());

create policy tags_insert_own
  on public.tags
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy tags_update_own
  on public.tags
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy tags_delete_own
  on public.tags
  for delete
  to authenticated
  using (user_id = auth.uid());
