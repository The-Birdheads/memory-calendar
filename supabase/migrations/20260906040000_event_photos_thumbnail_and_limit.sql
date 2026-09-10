-- 予定の思い出(写真)機能: 各ユーザーが1件のイベントにつき1枚まで追加でき、
-- 追加された写真の中から1枚を「サムネイル」として選べるようにする。
-- サムネイルが設定された予定だけが思い出タイムラインに表示される(listMemoriesTimeline側で対応)。

-- 1ユーザー1予定につき1枚まで
alter table public.event_photos
  add constraint event_photos_one_per_user_per_event unique (event_id, uploaded_by);

-- サムネイルフラグ: 1予定につき最大1枚まで(部分一意インデックスで表現)
alter table public.event_photos
  add column is_thumbnail boolean not null default false;

create unique index event_photos_unique_thumbnail_per_event
  on public.event_photos (event_id)
  where is_thumbnail;

-- サムネイルの選択・解除は「誰の写真か」に関わらずカレンダーメンバーなら誰でもできる
-- (共有の設定であり、対象の予定のUPDATEと同じ扱い)。
create policy event_photos_update_thumbnail_member
  on public.event_photos
  for update
  to authenticated
  using (public.is_event_calendar_member(event_id, auth.uid()))
  with check (public.is_event_calendar_member(event_id, auth.uid()));

-- 自分が追加した写真は自分で削除できる(1枚差し替えるための「削除してから追加し直す」用途)。
create policy event_photos_delete_own
  on public.event_photos
  for delete
  to authenticated
  using (uploaded_by = auth.uid());

-- Storage側も同様に、自分がアップロードしたオブジェクトのみ削除可能
-- (storage.objects.owner はアップロード時にauth.uid()が自動設定される)。
create policy event_photos_storage_delete_own
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'event-photos' and owner = auth.uid());
