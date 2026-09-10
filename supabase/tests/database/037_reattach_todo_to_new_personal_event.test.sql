-- タスク16.5: 孤立ToDoの個人用カレンダーでの新規予定作成による復活(RPC)を検証する

begin;
select plan(7);

select has_function(
  'public', 'reattach_todo_to_new_personal_event', array['uuid', 'text', 'date'],
  'reattach_todo_to_new_personal_event(uuid, text, date) 関数が存在すること'
);

-- セットアップ: サインアップ済みユーザー(個人用カレンダーは自動生成される)、孤立ToDo
set local role postgres;
insert into auth.users (id) values ('cccccccc-dddd-eeee-ffff-000000000001');

set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-dddd-eeee-ffff-000000000001';
insert into public.calendars (name) values ('グループカレンダー') returning id \gset grpCal_
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'grpCal_id', '孤立化させる予定', '2026-10-01T10:00:00+00', '2026-10-01T11:00:00+00')
  returning id \gset origEvent_
insert into public.todos (event_id, title) values (:'origEvent_id', '出発準備') returning id \gset todo_
delete from public.events where id = :'origEvent_id'::uuid;

-- RPCで個人用カレンダーへの新規予定作成と同時に再紐付けする
select * from public.reattach_todo_to_new_personal_event(
  :'todo_id'::uuid, '出発準備の日', '2026-10-05'
) \gset result_

select ok(
  :'result_event_id' is not null,
  '個人用カレンダーに新規予定が作成され、ToDoに紐付けられること'
);
select is(
  (select kind from public.calendars where id = (select calendar_id from public.events where id = :'result_event_id'::uuid)),
  'personal',
  '作成された予定が呼び出しユーザーの個人用カレンダーに属すること'
);
select is(
  (select title from public.events where id = :'result_event_id'::uuid),
  '出発準備の日',
  '作成された予定のタイトルが指定した値であること'
);
select is(
  (select is_all_day from public.events where id = :'result_event_id'::uuid),
  true,
  '日付のみを指定した予定は終日予定として作成されること'
);
select is(
  (select event_id from public.todos where id = :'todo_id'::uuid),
  :'result_event_id'::uuid,
  'ToDoのevent_idが新規作成された予定に更新されること(リマインド設定可能な通常のToDoとして扱われる)'
);

-- 他人のToDoに対しては実行できない
set local role postgres;
insert into auth.users (id) values ('cccccccc-dddd-eeee-ffff-000000000002');
set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-dddd-eeee-ffff-000000000002';
select throws_ok(
  format(
    $$ select * from public.reattach_todo_to_new_personal_event(%L, 'なりすまし', '2026-10-06') $$,
    :'todo_id'::uuid
  ),
  '42501',
  null,
  '他人のToDoに対してはreattach_todo_to_new_personal_eventを実行できないこと'
);

select * from finish();
rollback;
