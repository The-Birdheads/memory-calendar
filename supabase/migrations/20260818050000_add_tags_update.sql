-- タスク6.3: タグの編集(名称・色・階層)を許可するRLSポリシー

create policy tags_update_member
  on public.tags
  for update
  to authenticated
  using (public.is_calendar_member(calendar_id, auth.uid()))
  with check (public.is_calendar_member(calendar_id, auth.uid()));
