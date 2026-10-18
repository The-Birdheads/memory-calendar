-- 予定の対象者(event_assignees)とアイコン画像(avatars バケット)を検証する

begin;
select plan(12);

select has_column('public', 'profiles', 'avatar_path', 'profiles に avatar_path 列があること');
select has_table('public', 'event_assignees', 'event_assignees テーブルが存在すること');
select is(
  (select relrowsecurity from pg_class where oid = 'public.event_assignees'::regclass),
  true,
  'event_assignees テーブルで RLS が有効であること'
);
select policies_are(
  'public', 'event_assignees',
  array['event_assignees_delete_member', 'event_assignees_insert_member', 'event_assignees_select_member'],
  'event_assignees に想定通りのRLSポリシーが定義されていること'
);
select is(
  (select public from storage.buckets where id = 'avatars'),
  false,
  'avatars バケットが非公開で存在すること'
);

-- セットアップ: 共有カレンダー(owner A + member B)と、メンバーではないC
set local role postgres;
insert into auth.users (id) values
  ('88888888-8888-9999-bbbb-000000000001'), -- A: owner
  ('88888888-8888-9999-bbbb-000000000002'), -- B: member
  ('88888888-8888-9999-bbbb-000000000003'); -- C: 非メンバー

set local role authenticated;
set local request.jwt.claim.sub = '88888888-8888-9999-bbbb-000000000001';
insert into public.calendars (name) values ('対象者検証用') returning id \gset cal50_
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'cal50_id', '検証予定', '2026-09-10T10:00:00+00', '2026-09-10T11:00:00+00')
  returning id \gset event50_

set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role)
  values (:'cal50_id', '88888888-8888-9999-bbbb-000000000002', 'editor');

set local role authenticated;
set local request.jwt.claim.sub = '88888888-8888-9999-bbbb-000000000001';

select lives_ok(
  format($$ insert into public.event_assignees (event_id, user_id) values (%L, '88888888-8888-9999-bbbb-000000000002') $$, :'event50_id'),
  'カレンダーのメンバーを対象者に設定できること'
);
select throws_ok(
  format($$ insert into public.event_assignees (event_id, user_id) values (%L, '88888888-8888-9999-bbbb-000000000003') $$, :'event50_id'),
  '23514',
  null,
  'カレンダーのメンバーではないユーザーは対象者にできないこと'
);

-- 非メンバーCには見えない
set local request.jwt.claim.sub = '88888888-8888-9999-bbbb-000000000003';
select is(
  (select count(*)::int from public.event_assignees),
  0,
  'カレンダーのメンバーではないユーザーには対象者が見えないこと'
);

-- メンバーBには見える
set local request.jwt.claim.sub = '88888888-8888-9999-bbbb-000000000002';
select is(
  (select count(*)::int from public.event_assignees),
  1,
  'カレンダーのメンバーには対象者が見えること'
);

-- メンバーがカレンダーから抜けたら、対象者からも外れる
set local role postgres;
delete from public.calendar_members
  where calendar_id = :'cal50_id' and user_id = '88888888-8888-9999-bbbb-000000000002';
select is(
  (select count(*)::int from public.event_assignees where event_id = :'event50_id'),
  0,
  'カレンダーから抜けたメンバーは対象者からも外れること'
);

-- 個人用カレンダーの予定は対象者を設定できない
set local role authenticated;
set local request.jwt.claim.sub = '88888888-8888-9999-bbbb-000000000001';
select id as personal50_id from public.calendars where kind = 'personal' and created_by = '88888888-8888-9999-bbbb-000000000001' \gset
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'personal50_id', '個人の予定', '2026-09-10T10:00:00+00', '2026-09-10T11:00:00+00')
  returning id \gset pevent50_
select throws_ok(
  format($$ insert into public.event_assignees (event_id, user_id) values (%L, '88888888-8888-9999-bbbb-000000000001') $$, :'pevent50_id'),
  '23514',
  null,
  '個人用カレンダーの予定には対象者を設定できないこと'
);

-- 予定の削除で対象者の行も消える
set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role)
  values (:'cal50_id', '88888888-8888-9999-bbbb-000000000002', 'editor');
insert into public.event_assignees (event_id, user_id) values (:'event50_id', '88888888-8888-9999-bbbb-000000000002');
delete from public.events where id = :'event50_id';
select is(
  (select count(*)::int from public.event_assignees where event_id = :'event50_id'),
  0,
  '予定を削除すると対象者の行も消えること'
);

select * from finish();
rollback;
