-- タスク16.1: 予定削除時にToDoを削除せず、紐付けのみを解除する

alter table public.todos
  drop constraint todos_event_id_fkey,
  alter column event_id drop not null;

alter table public.todos
  add constraint todos_event_id_fkey
  foreign key (event_id) references public.events (id) on delete set null;

-- 孤立ToDo(紐付け解除済み)の一覧取得用の部分インデックス
create index todos_created_by_orphaned_idx on public.todos (created_by) where event_id is null;
