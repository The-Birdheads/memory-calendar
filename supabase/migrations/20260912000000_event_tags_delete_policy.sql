-- event_tags には select/insert のRLSポリシーしか無く、DELETEのポリシーが
-- 一度も定義されていなかった(見落とし)。ポリシーが無いテーブルへのDELETEは
-- 「対象行なし」として常に0件で成功する(エラーにはならない)ため、
-- detachTagFromEvent()(予定からタグを外す操作)は今まで実際にはDBに反映
-- されず、再読み込みするとタグが元に戻って見えるという不具合になっていた。
--
-- insert/selectと同じ条件(タグの所有者本人であり、かつその予定のカレンダー
-- メンバーであること)でDELETEを許可する。
create policy event_tags_delete_own
  on public.event_tags
  for delete
  to authenticated
  using (
    public.is_event_calendar_member(event_id, auth.uid())
    and exists (select 1 from public.tags t where t.id = tag_id and t.user_id = auth.uid())
  );
