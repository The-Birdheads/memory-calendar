-- タスク16.2: ToDoを作成者本人にのみ表示・操作可能にする(カレンダーメンバーシップは参照しない)

drop policy todos_select_member on public.todos;
drop policy todos_insert_member on public.todos;
drop policy todos_update_member on public.todos;
drop policy todos_delete_member on public.todos;

create policy todos_select_own
  on public.todos
  for select
  to authenticated
  using (created_by = auth.uid());

-- INSERT/UPDATE: 作成者本人であることに加え、event_idを設定する場合は
-- 呼び出しユーザーがその予定を閲覧できること(カレンダーメンバーであること)を要求する
create policy todos_insert_own
  on public.todos
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and (event_id is null or public.is_event_calendar_member(event_id, auth.uid()))
  );

create policy todos_update_own
  on public.todos
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (
    created_by = auth.uid()
    and (event_id is null or public.is_event_calendar_member(event_id, auth.uid()))
  );

create policy todos_delete_own
  on public.todos
  for delete
  to authenticated
  using (created_by = auth.uid());
