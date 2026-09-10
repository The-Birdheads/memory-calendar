-- タスク16.1: 予定削除時にToDoを削除せず、紐付けが解除された状態で保持されることを検証する

begin;
select plan(6);

-- セットアップ
set local role postgres;
insert into auth.users (id) values ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee1');

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee1';
insert into public.calendars (name) values ('ToDo孤立化検証用') returning id \gset cal_
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'cal_id', '削除予定のイベント', '2026-09-25T10:00:00+00', '2026-09-25T11:00:00+00')
  returning id \gset event_
insert into public.todos (event_id, title) values (:'event_id', '準備をする') returning id \gset todo_

-- 予定を削除する
delete from public.events where id = :'event_id'::uuid;

select ok(
  not exists(select 1 from public.events where id = :'event_id'::uuid),
  '前提: 予定が削除されていること'
);
select ok(
  exists(select 1 from public.todos where id = :'todo_id'::uuid),
  '予定削除後もToDo自体は削除されずに残ること'
);
select is(
  (select event_id from public.todos where id = :'todo_id'::uuid),
  null,
  '予定削除後、ToDoのevent_idがNULLになり紐付けが解除されること'
);

-- 孤立ToDo一覧(listOrphanedTodos相当)に表示され続けること(要件9.8)
select is(
  (select count(*) from public.todos where created_by = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee1'::uuid and event_id is null),
  1::bigint,
  '紐付けが解除されたToDoが孤立ToDo一覧に表示され続けること'
);

-- 紐付けの解除されたToDoは、既存の別の予定へ再紐付けできる(要件9.9)
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'cal_id', '再紐付け先イベント', '2026-09-26T10:00:00+00', '2026-09-26T11:00:00+00')
  returning id \gset newEvent_
update public.todos set event_id = :'newEvent_id'::uuid where id = :'todo_id'::uuid;

select is(
  (select event_id from public.todos where id = :'todo_id'::uuid),
  :'newEvent_id'::uuid,
  '孤立ToDoを既存の予定へ再紐付けできること'
);

-- 再紐付け後は孤立ToDo一覧から外れる
select is(
  (select count(*) from public.todos where created_by = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee1'::uuid and event_id is null),
  0::bigint,
  '再紐付け後は孤立ToDo一覧に表示されないこと'
);

select * from finish();
rollback;
