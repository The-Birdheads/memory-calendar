-- タスク4.4: 繰り返しシリーズのまとめ編集・削除を検証する
-- EventService.updateEvent/deleteEvent(scope: "series")が発行するSQL形状
-- (series_idによる一括UPDATE/DELETE)を、既存のRLSポリシーの上で直接検証する。

begin;
select plan(8);

set local role postgres;
insert into auth.users (id) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'), -- owner
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'), -- viewer(まとめ編集を行う)
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3'); -- 非メンバー

set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
insert into public.calendars (name) values ('まとめ編集検証用') returning id \gset cal6_

set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role)
  values (:'cal6_id'::uuid, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'viewer');

set local role authenticated;
select * from public.create_recurring_series(
  :'cal6_id'::uuid, '毎週買い物', '2026-09-01T09:00:00+00', '2026-09-01T10:00:00+00',
  'weekly', '2026-09-15T09:00:00+00'
);

select is(
  (select count(*) from public.events where calendar_id = :'cal6_id'::uuid and title = '毎週買い物'),
  3::bigint,
  '前提: 毎週買い物シリーズが3回分生成されていること'
);

-- 別のカレンダーメンバー(viewer)がまとめ編集(日時以外)を実行する
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2';
update public.events
  set title = '毎週買い物(変更後)', location = 'スーパー'
  where series_id = (
    select series_id from public.events
    where calendar_id = :'cal6_id'::uuid and title = '毎週買い物' limit 1
  );

select is(
  (select count(*) from public.events
     where calendar_id = :'cal6_id'::uuid and title = '毎週買い物(変更後)' and location = 'スーパー'),
  3::bigint,
  'まとめ編集を実行すると、全ての回に変更が反映されること'
);
select is(
  (select count(distinct updated_by) from public.events
     where calendar_id = :'cal6_id'::uuid and title = '毎週買い物(変更後)'),
  1::bigint,
  'まとめ編集を行った操作者が全ての回のupdated_byに記録されること'
);
select is(
  (select updated_by from public.events
     where calendar_id = :'cal6_id'::uuid and title = '毎週買い物(変更後)' limit 1),
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'::uuid,
  'updated_byがまとめ編集を実行した操作者になっていること'
);
select is(
  (select count(distinct created_by) from public.events
     where calendar_id = :'cal6_id'::uuid and title = '毎週買い物(変更後)'),
  1::bigint,
  'まとめ編集後もcreated_byが元の作成者のまま不変であること'
);

-- 非メンバーはまとめ編集・削除できない
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3';
update public.events
  set title = '不正な一括変更'
  where calendar_id = :'cal6_id'::uuid and title = '毎週買い物(変更後)';

select is(
  (select count(*) from public.events
     where calendar_id = :'cal6_id'::uuid and title = '不正な一括変更'),
  0::bigint,
  '非メンバーがまとめ編集を試みても変更が反映されないこと'
);

delete from public.events
  where calendar_id = :'cal6_id'::uuid and title = '毎週買い物(変更後)';

select is(
  (select count(*) from public.events
     where calendar_id = :'cal6_id'::uuid and title = '毎週買い物(変更後)'),
  3::bigint,
  '非メンバーがシリーズ削除を試みても予定は削除されないこと'
);

-- カレンダーメンバーによるシリーズ単位の削除は成功する
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
delete from public.events
  where series_id = (
    select series_id from public.events
    where calendar_id = :'cal6_id'::uuid and title = '毎週買い物(変更後)' limit 1
  );

select is(
  (select count(*) from public.events
     where calendar_id = :'cal6_id'::uuid and title = '毎週買い物(変更後)'),
  0::bigint,
  'カレンダーメンバーによるシリーズ単位の削除で全ての回が削除されること'
);

select * from finish();
rollback;
