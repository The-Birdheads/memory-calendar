-- タスク10.3: 献立記録の編集・削除を許可するRLSポリシー

create policy meal_records_update_member
  on public.meal_records
  for update
  to authenticated
  using (public.is_calendar_member(calendar_id, auth.uid()))
  with check (public.is_calendar_member(calendar_id, auth.uid()));

create policy meal_records_delete_member
  on public.meal_records
  for delete
  to authenticated
  using (public.is_calendar_member(calendar_id, auth.uid()));
