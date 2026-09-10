-- グループカレンダーの削除/退出(leave_or_delete_calendar RPC)を検証する
-- 個人用カレンダーは削除不可。他にメンバーがいれば自分だけ抜ける、自分のみなら
-- カレンダー自体を削除し、関連データがcascadeで削除されることを確認する。

begin;
select plan(11);

select has_function(
  'public', 'leave_or_delete_calendar', array['uuid'],
  'leave_or_delete_calendar(uuid) 関数が存在すること'
);
select is(
  (select prosecdef from pg_proc where proname = 'leave_or_delete_calendar' and pronamespace = 'public'::regnamespace),
  true,
  'leave_or_delete_calendar は SECURITY DEFINER であること'
);

-- セットアップ: オーナー・共同編集者ユーザーと、複数人グループ・単独グループ
set local role postgres;
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'), -- 複数人グループのオーナー(個人用カレンダーも自動作成される)
  ('22222222-2222-2222-2222-222222222222'), -- 複数人グループの他メンバー
  ('33333333-3333-3333-3333-333333333333'); -- 単独グループのオーナー

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.calendars (name) values ('複数人グループ') returning id \gset multi_
insert into public.events (calendar_id, title, start_at, end_at)
values (:'multi_id'::uuid, '複数人グループの予定', now(), now() + interval '1 hour')
returning id \gset multi_event_

set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role)
values (:'multi_id'::uuid, '22222222-2222-2222-2222-222222222222', 'viewer');

set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
insert into public.calendars (name) values ('単独グループ') returning id \gset solo_
insert into public.events (calendar_id, title, start_at, end_at)
values (:'solo_id'::uuid, '単独グループの予定', now(), now() + interval '1 hour')
returning id \gset solo_event_

-- 個人用カレンダーは削除できない
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select id from public.calendars
where created_by = '11111111-1111-1111-1111-111111111111' and kind = 'personal' \gset personal_

select throws_ok(
  format($$ select public.leave_or_delete_calendar(%L::uuid) $$, :'personal_id'),
  null,
  null,
  '個人用カレンダーは leave_or_delete_calendar で削除できないこと'
);

-- メンバーでないユーザーは操作できない
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select throws_ok(
  format($$ select public.leave_or_delete_calendar(%L::uuid) $$, :'multi_id'),
  null,
  null,
  'メンバーでないユーザーは操作できないこと'
);

-- 複数人グループ: 他メンバーがいる場合は自分だけ抜ける(カレンダー自体は残る)
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.leave_or_delete_calendar(:'multi_id'::uuid) as result \gset leave_

select is(
  :'leave_result'::boolean,
  false,
  '他にメンバーがいる場合、戻り値はfalse(退出のみ)であること'
);

-- 退出後のユーザーはRLS上そのカレンダーを見えなくなるため、以降の存在確認は
-- postgresロール(RLSを回避)で行う。
set local role postgres;
select ok(
  not exists(
    select 1 from public.calendar_members
    where calendar_id = :'multi_id'::uuid
      and user_id = '22222222-2222-2222-2222-222222222222'
  ),
  '退出したユーザーが calendar_members から削除されていること'
);
select ok(
  exists(select 1 from public.calendars where id = :'multi_id'::uuid),
  '他にメンバーがいる場合、カレンダー自体は削除されないこと'
);
select ok(
  exists(select 1 from public.events where id = :'multi_event_id'::uuid),
  '他にメンバーがいる場合、既存の予定は削除されないこと'
);
set local role authenticated;

-- 単独グループ: 自分のみの場合はカレンダー自体を削除する(cascadeで関連データも削除)
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select public.leave_or_delete_calendar(:'solo_id'::uuid) as result \gset delete_

select is(
  :'delete_result'::boolean,
  true,
  '自分のみの場合、戻り値はtrue(カレンダー削除)であること'
);

set local role postgres;
select ok(
  not exists(select 1 from public.calendars where id = :'solo_id'::uuid),
  '自分のみの場合、カレンダー自体が削除されること'
);
select ok(
  not exists(select 1 from public.events where id = :'solo_event_id'::uuid),
  'カレンダー削除時、配下の予定もcascadeで削除されること'
);

select * from finish();
rollback;
