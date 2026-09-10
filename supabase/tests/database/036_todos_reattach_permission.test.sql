-- タスク16.4: 孤立ToDoの既存予定への再紐付けが、呼び出しユーザーの閲覧可能な予定に限られることを検証する

begin;
select plan(4);

-- セットアップ: ToDo所有者と、別カレンダーを持つ第三者
set local role postgres;
insert into auth.users (id) values
  ('bbbbbbbb-cccc-dddd-eeee-ffffffffff01'), -- ToDo所有者
  ('bbbbbbbb-cccc-dddd-eeee-ffffffffff02'); -- 第三者(所有者と予定を共有しない)

set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-cccc-dddd-eeee-ffffffffff01';
insert into public.calendars (name) values ('自分のグループカレンダー') returning id \gset ownCal_
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'ownCal_id', '孤立化させる予定', '2026-09-27T10:00:00+00', '2026-09-27T11:00:00+00')
  returning id \gset origEvent_
insert into public.todos (event_id, title) values (:'origEvent_id', '買い出し') returning id \gset todo_
delete from public.events where id = :'origEvent_id'::uuid;

-- 呼び出しユーザーが閲覧できる別の予定(自分のカレンダー内)への再紐付けは成功する
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'ownCal_id', '再紐付け先(自分のカレンダー)', '2026-09-28T10:00:00+00', '2026-09-28T11:00:00+00')
  returning id \gset ownEvent_
update public.todos set event_id = :'ownEvent_id'::uuid where id = :'todo_id'::uuid;

select is(
  (select event_id from public.todos where id = :'todo_id'::uuid),
  :'ownEvent_id'::uuid,
  '自分が閲覧できる予定への再紐付けは成功すること'
);

-- 一旦孤立状態に戻す
update public.todos set event_id = null where id = :'todo_id'::uuid;

-- 第三者の(自分が参加していない)カレンダーの予定への再紐付けはできない
set local request.jwt.claim.sub = 'bbbbbbbb-cccc-dddd-eeee-ffffffffff02';
insert into public.calendars (name) values ('第三者のカレンダー') returning id \gset otherCal_
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'otherCal_id', '第三者の予定', '2026-09-29T10:00:00+00', '2026-09-29T11:00:00+00')
  returning id \gset otherEvent_

set local request.jwt.claim.sub = 'bbbbbbbb-cccc-dddd-eeee-ffffffffff01';
select throws_ok(
  format(
    $$ update public.todos set event_id = %L where id = %L $$,
    :'otherEvent_id'::uuid, :'todo_id'::uuid
  ),
  '42501',
  null,
  '自分が閲覧できない予定への再紐付けはRLSで拒否されること'
);
select is(
  (select event_id from public.todos where id = :'todo_id'::uuid),
  null,
  '拒否された再紐付けの試行後もToDoは孤立状態のままであること'
);

-- 他人のToDoを自分の予定に再紐付けすることはできない(created_by本人であることが前提、要件の事前条件)
set local role postgres;
insert into auth.users (id) values ('bbbbbbbb-cccc-dddd-eeee-ffffffffff03');
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-cccc-dddd-eeee-ffffffffff01';
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'ownCal_id', 'なりすまし紐付け先', '2026-09-30T10:00:00+00', '2026-09-30T11:00:00+00')
  returning id \gset ownEvent2_

-- 他人のToDoはUSING句の時点で対象行として見えないため、UPDATEは例外を投げずに0件のまま何も変更しない
set local request.jwt.claim.sub = 'bbbbbbbb-cccc-dddd-eeee-ffffffffff03';
update public.todos set event_id = :'ownEvent2_id'::uuid where id = :'todo_id'::uuid;

set local request.jwt.claim.sub = 'bbbbbbbb-cccc-dddd-eeee-ffffffffff01';
select is(
  (select event_id from public.todos where id = :'todo_id'::uuid),
  null,
  '他人による再紐付けの試行後もToDoは孤立状態のままであること'
);

select * from finish();
rollback;
