-- タスク6.4: タグ削除を許可するRLSポリシー
-- カスケード削除自体はtags.parent_id/event_tags.tag_idのON DELETE CASCADE(タスク6.1/6.2)で既に設定済み

create policy tags_delete_member
  on public.tags
  for delete
  to authenticated
  using (public.is_calendar_member(calendar_id, auth.uid()));
