-- タスク6.2: event_tagsスキーマ(予定への複数タグ付与)を検証する

begin;
select plan(9);

select has_table('public', 'event_tags', 'event_tags テーブルが存在すること');
select col_is_pk(
  'public', 'event_tags', array['event_id', 'tag_id'],
  'event_tags が (event_id, tag_id) の複合主キーであること'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.event_tags'::regclass),
  true,
  'event_tags テーブルで RLS が有効であること'
);
select policies_are(
  'public', 'event_tags',
  array['event_tags_insert_member', 'event_tags_select_member'],
  'event_tags に想定通りのRLSポリシーが定義されていること'
);

-- セットアップ: owner + viewerが所属するカレンダー、予定、複数タグ
set local role postgres;
insert into auth.users (id) values
  ('11111111-2222-3333-4444-555555555551'), -- owner
  ('11111111-2222-3333-4444-555555555552'); -- viewer

set local role authenticated;
set local request.jwt.claim.sub = '11111111-2222-3333-4444-555555555551';
insert into public.calendars (name) values ('タグ付与検証用') returning id \gset cal11_

set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role)
  values (:'cal11_id'::uuid, '11111111-2222-3333-4444-555555555552', 'viewer');

set local role authenticated;
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'cal11_id', 'タグ付与検証予定', '2026-09-14T10:00:00+00', '2026-09-14T11:00:00+00')
  returning id \gset event11_

insert into public.tags (calendar_id, level, name, color)
  values (:'cal11_id', 'major', '行事', '#ff0000') returning id \gset tagA_
insert into public.tags (calendar_id, level, name, color)
  values (:'cal11_id', 'major', '外出', '#00ff00') returning id \gset tagB_

-- 予定に複数タグを設定する(attachTagsToEvent相当)
insert into public.event_tags (event_id, tag_id) values
  (:'event11_id', :'tagA_id'),
  (:'event11_id', :'tagB_id');

select is(
  (select count(*) from public.event_tags where event_id = :'event11_id'::uuid),
  2::bigint,
  '予定に複数タグを設定すると全て反映されること'
);

-- 別のカレンダーメンバーは設定されたタグを閲覧できる
set local request.jwt.claim.sub = '11111111-2222-3333-4444-555555555552';
select is(
  (select count(*) from public.event_tags where event_id = :'event11_id'::uuid),
  2::bigint,
  '他のカレンダーメンバーが設定されたタグを閲覧できること'
);

-- 予定を削除するとevent_tagsも連鎖削除される
set local request.jwt.claim.sub = '11111111-2222-3333-4444-555555555551';
delete from public.events where id = :'event11_id'::uuid;

select is(
  (select count(*) from public.event_tags where event_id = :'event11_id'::uuid),
  0::bigint,
  '予定を削除するとevent_tagsが連鎖削除されること'
);

-- 非メンバーは閲覧・登録できない
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'cal11_id', '非メンバー検証予定', '2026-09-15T10:00:00+00', '2026-09-15T11:00:00+00')
  returning id \gset event12_
insert into public.event_tags (event_id, tag_id) values (:'event12_id', :'tagA_id');

set local role postgres;
insert into auth.users (id) values ('11111111-2222-3333-4444-555555555553');
set local role authenticated;
set local request.jwt.claim.sub = '11111111-2222-3333-4444-555555555553';

select is(
  (select count(*) from public.event_tags where event_id = :'event12_id'::uuid),
  0::bigint,
  '非メンバーはevent_tagsを閲覧できないこと'
);
select throws_ok(
  $$ insert into public.event_tags (event_id, tag_id) values (:'event12_id', :'tagA_id') $$,
  '42501',
  null,
  '非メンバーはevent_tagsに登録できないこと'
);

select * from finish();
rollback;
