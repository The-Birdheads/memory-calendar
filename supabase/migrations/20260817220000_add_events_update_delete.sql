-- タスク4.2: 予定の編集・削除を許可するRLSポリシーと最終更新者の自動記録

-- 更新時にupdated_byを操作者へ自動記録し、created_byを不変に保つ
create or replace function public.handle_event_update()
returns trigger
language plpgsql
as $$
begin
  new.created_by = old.created_by;
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger on_event_update
  before update on public.events
  for each row execute function public.handle_event_update();

-- events: カレンダーメンバーは編集・削除できる
create policy events_update_member
  on public.events
  for update
  to authenticated
  using (public.is_calendar_member(calendar_id, auth.uid()))
  with check (public.is_calendar_member(calendar_id, auth.uid()));

create policy events_delete_member
  on public.events
  for delete
  to authenticated
  using (public.is_calendar_member(calendar_id, auth.uid()));

-- 注記: todos/event_tags/event_reminder_targets/event_photos/event_comments/event_reactionsは
-- 未作成のため、event_idへのON DELETE CASCADEは各テーブルの作成マイグレーション
-- (タスク4.6, 5.1, 5.2, 6.2, 8.1, 9.1)側で設定する。予定削除時にこれらが連鎖削除されることで
-- 「思い出データも削除されます」という確認モーダルの警告(3.9)の実効性が担保される。
