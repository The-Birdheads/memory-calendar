-- タスク8.1: event_photosスキーマとStorageバケットのRLSを検証する

begin;
select plan(14);

select has_table('public', 'event_photos', 'event_photos テーブルが存在すること');
select has_column('public', 'event_photos', 'event_id', 'event_photos.event_id 列が存在すること');
select has_column('public', 'event_photos', 'storage_path', 'event_photos.storage_path 列が存在すること');
select has_column('public', 'event_photos', 'uploaded_by', 'event_photos.uploaded_by 列が存在すること');
select col_is_pk('public', 'event_photos', 'id', 'event_photos.id が主キーであること');
select is(
  (select relrowsecurity from pg_class where oid = 'public.event_photos'::regclass),
  true,
  'event_photos テーブルで RLS が有効であること'
);
select policies_are(
  'public', 'event_photos',
  array[
    'event_photos_delete_own',
    'event_photos_insert_member',
    'event_photos_select_member',
    'event_photos_update_thumbnail_member'
  ],
  'event_photos に想定通りのRLSポリシーが定義されていること'
);
select ok(
  exists(select 1 from storage.buckets where id = 'event-photos' and public = false),
  'event-photos Storageバケットが非公開で作成されていること'
);

-- セットアップ: owner + viewerが所属するカレンダーと実施済み予定
set local role postgres;
insert into auth.users (id) values
  ('55555555-6666-7777-8888-999999999991'), -- owner
  ('55555555-6666-7777-8888-999999999992'); -- viewer

set local role authenticated;
set local request.jwt.claim.sub = '55555555-6666-7777-8888-999999999991';
insert into public.calendars (name) values ('写真検証用') returning id \gset cal15_

set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role)
  values (:'cal15_id'::uuid, '55555555-6666-7777-8888-999999999992', 'viewer');

set local role authenticated;
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'cal15_id', '実施済み予定', '2026-01-01T10:00:00+00', '2026-01-01T11:00:00+00')
  returning id \gset pastEvent16_

-- viewerが写真を追加する(event_photos行の保存を検証)
set local request.jwt.claim.sub = '55555555-6666-7777-8888-999999999992';
insert into public.event_photos (event_id, storage_path)
  values (:'pastEvent16_id', :'pastEvent16_id' || '/photo.jpg');

select is(
  (select count(*) from public.event_photos where event_id = :'pastEvent16_id'::uuid),
  1::bigint,
  '実施済み予定に写真を添付すると保存されること'
);

-- 他のカレンダーメンバー(owner)は保存された写真を閲覧できる
set local request.jwt.claim.sub = '55555555-6666-7777-8888-999999999991';
select is(
  (select count(*) from public.event_photos where event_id = :'pastEvent16_id'::uuid),
  1::bigint,
  '他のカレンダーメンバーが添付された写真を閲覧できること'
);

-- storage.objects: カレンダーメンバーはアップロード・閲覧できる
insert into storage.objects (bucket_id, name, owner)
  values ('event-photos', :'pastEvent16_id' || '/photo.jpg', '55555555-6666-7777-8888-999999999991');
select is(
  (select count(*) from storage.objects
     where bucket_id = 'event-photos' and name = :'pastEvent16_id' || '/photo.jpg'),
  1::bigint,
  'カレンダーメンバーはStorageオブジェクトを閲覧できること'
);

-- 予定を削除するとevent_photosも連鎖削除される
delete from public.events where id = :'pastEvent16_id'::uuid;
select is(
  (select count(*) from public.event_photos where event_id = :'pastEvent16_id'::uuid),
  0::bigint,
  '予定を削除するとevent_photosが連鎖削除されること'
);

-- 非メンバーは閲覧・追加できない
set local role postgres;
insert into auth.users (id) values ('55555555-6666-7777-8888-999999999993');
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'cal15_id', '非メンバー検証予定', '2026-01-02T10:00:00+00', '2026-01-02T11:00:00+00')
  returning id \gset otherEvent16_
insert into public.event_photos (event_id, storage_path)
  values (:'otherEvent16_id', :'otherEvent16_id' || '/photo.jpg');

set local role authenticated;
set local request.jwt.claim.sub = '55555555-6666-7777-8888-999999999993';
select is(
  (select count(*) from public.event_photos where event_id = :'otherEvent16_id'::uuid),
  0::bigint,
  '非メンバーはevent_photosを閲覧できないこと'
);
select throws_ok(
  format(
    $$ insert into public.event_photos (event_id, storage_path)
       values (%L, %L) $$,
    :'otherEvent16_id', :'otherEvent16_id' || '/other.jpg'
  ),
  '42501',
  null,
  '非メンバーはevent_photosに追加できないこと'
);

select * from finish();
rollback;
