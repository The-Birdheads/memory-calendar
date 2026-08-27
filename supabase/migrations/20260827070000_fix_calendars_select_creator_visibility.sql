-- 不具合修正: カレンダー作成直後にRLSエラーになる問題
--
-- `createCalendar`は `.insert(...).select().single()` (Prefer: return=representation) を使うため、
-- INSERT成功後にRETURNINGでその行をSELECTできる必要がある。既存の calendars_select_member ポリシーは
-- is_calendar_member(id, auth.uid()) のみを条件としており、これは on_calendar_created トリガー
-- (AFTER INSERT ON calendars) が calendar_members へ追加した行に依存する。
-- しかしPostgresはINSERT ... RETURNINGのRLS可視性チェックをAFTER INSERTトリガーの効果が
-- 反映される前に評価するため、作成者自身であってもRETURNING時点では
-- is_calendar_member() が false と評価され、"new row violates row-level security policy for
-- table calendars" というRLSエラーで作成自体が失敗する(実際の行はコミットされない)。
--
-- 作成者は(トリガー結果を待たずとも)常に自分が作成したカレンダーを閲覧できてしかるべきなので、
-- created_by = auth.uid() を許可条件に追加する。
drop policy if exists calendars_select_member on public.calendars;

create policy calendars_select_member
  on public.calendars
  for select
  to authenticated
  using (
    created_by = auth.uid()
    or public.is_calendar_member(id, auth.uid())
  );
