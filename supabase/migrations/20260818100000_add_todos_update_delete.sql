-- タスク9.3: ToDoの達成状況変更・編集・削除を許可するRLSポリシー

create policy todos_update_member
  on public.todos
  for update
  to authenticated
  using (public.is_event_calendar_member(event_id, auth.uid()))
  with check (public.is_event_calendar_member(event_id, auth.uid()));

create policy todos_delete_member
  on public.todos
  for delete
  to authenticated
  using (public.is_event_calendar_member(event_id, auth.uid()));
