-- タスク15.2: event_tagsの閲覧・登録に、紐付け対象タグが自分自身の所有であることを追加で要求する

drop policy event_tags_select_member on public.event_tags;
drop policy event_tags_insert_member on public.event_tags;

create policy event_tags_select_member
  on public.event_tags
  for select
  to authenticated
  using (
    public.is_event_calendar_member(event_id, auth.uid())
    and exists (select 1 from public.tags t where t.id = tag_id and t.user_id = auth.uid())
  );

create policy event_tags_insert_member
  on public.event_tags
  for insert
  to authenticated
  with check (
    public.is_event_calendar_member(event_id, auth.uid())
    and exists (select 1 from public.tags t where t.id = tag_id and t.user_id = auth.uid())
  );
