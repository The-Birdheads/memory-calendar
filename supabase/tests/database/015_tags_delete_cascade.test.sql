-- タスク6.4: タグ削除のカスケード(配下タグ・event_tags紐付け)を検証する

begin;
select plan(7);

select policies_are(
  'public', 'tags',
  array['tags_delete_member', 'tags_insert_member', 'tags_select_member', 'tags_update_member'],
  'tags に削除ポリシーを含む想定通りのRLSポリシーが定義されていること'
);

-- セットアップ: owner + viewerが所属するカレンダー、大/中/小の3階層タグ、予定への紐付け
set local role postgres;
insert into auth.users (id) values
  ('33333333-4444-5555-6666-777777777771'), -- owner
  ('33333333-4444-5555-6666-777777777772'); -- viewer

set local role authenticated;
set local request.jwt.claim.sub = '33333333-4444-5555-6666-777777777771';
insert into public.calendars (name) values ('タグ削除検証用') returning id \gset cal13_

set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role)
  values (:'cal13_id'::uuid, '33333333-4444-5555-6666-777777777772', 'viewer');

set local role authenticated;
insert into public.tags (calendar_id, level, name, color)
  values (:'cal13_id', 'major', '行事', '#ff0000') returning id \gset tagMajor14_
insert into public.tags (calendar_id, level, name, color, parent_id)
  values (:'cal13_id', 'mid', '誕生日', '#00ff00', :'tagMajor14_id') returning id \gset tagMid14_
insert into public.tags (calendar_id, level, name, color, parent_id)
  values (:'cal13_id', 'minor', '家族の誕生日', '#0000ff', :'tagMid14_id') returning id \gset tagMinor14_

insert into public.events (calendar_id, title, start_at, end_at)
  values (:'cal13_id', 'カスケード検証予定', '2026-09-17T10:00:00+00', '2026-09-17T11:00:00+00')
  returning id \gset event14_
insert into public.event_tags (event_id, tag_id) values
  (:'event14_id', :'tagMajor14_id'),
  (:'event14_id', :'tagMid14_id'),
  (:'event14_id', :'tagMinor14_id');

select is(
  (select count(*) from public.tags where calendar_id = :'cal13_id'::uuid),
  3::bigint,
  '前提: 大/中/小の3階層タグが作成されていること'
);
select is(
  (select count(*) from public.event_tags where event_id = :'event14_id'::uuid),
  3::bigint,
  '前提: 3つのタグがすべて予定に紐づいていること'
);

-- 別のカレンダーメンバー(viewer)が大分類タグを削除する
set local request.jwt.claim.sub = '33333333-4444-5555-6666-777777777772';
delete from public.tags where id = :'tagMajor14_id'::uuid;

select is(
  (select count(*) from public.tags where calendar_id = :'cal13_id'::uuid),
  0::bigint,
  '大分類タグを削除すると配下の中分類・小分類タグも全て削除されること'
);
select is(
  (select count(*) from public.event_tags where event_id = :'event14_id'::uuid),
  0::bigint,
  '削除されたタグの予定への紐付けも全て削除されること'
);

-- 非メンバーはタグを削除できない
set local request.jwt.claim.sub = '33333333-4444-5555-6666-777777777771';
insert into public.tags (calendar_id, level, name, color)
  values (:'cal13_id', 'major', '外出', '#123456') returning id \gset tagOther14_

set local role postgres;
insert into auth.users (id) values ('33333333-4444-5555-6666-777777777773');
set local role authenticated;
set local request.jwt.claim.sub = '33333333-4444-5555-6666-777777777773';
delete from public.tags where id = :'tagOther14_id'::uuid;

select is(
  (select count(*) from public.tags where id = :'tagOther14_id'::uuid),
  1::bigint,
  '非メンバーがタグ削除を試みても削除されないこと'
);

-- カレンダーメンバーによる削除は成功する
set local request.jwt.claim.sub = '33333333-4444-5555-6666-777777777771';
delete from public.tags where id = :'tagOther14_id'::uuid;

select is(
  (select count(*) from public.tags where id = :'tagOther14_id'::uuid),
  0::bigint,
  'カレンダーメンバーによる削除は成功すること'
);

select * from finish();
rollback;
