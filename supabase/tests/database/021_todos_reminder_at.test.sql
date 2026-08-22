-- タスク9.4: ToDoのリマインド日時設定を検証する

begin;
select plan(4);

select has_column('public', 'todos', 'reminder_at', 'todos.reminder_at 列が存在すること');

-- セットアップ
set local role postgres;
insert into auth.users (id) values ('99999999-0000-1111-2222-333333333331');
set local role authenticated;
set local request.jwt.claim.sub = '99999999-0000-1111-2222-333333333331';
insert into public.calendars (name) values ('ToDoリマインド検証用') returning id \gset cal19_
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'cal19_id', 'ToDoリマインド検証予定', '2026-09-20T10:00:00+00', '2026-09-20T11:00:00+00')
  returning id \gset event19_

-- リマインド日時を設定して登録する
insert into public.todos (event_id, title, reminder_at)
  values (:'event19_id', '飲み物を買う', '2026-09-19T09:00:00+00')
  returning id \gset todo19_

select is(
  (select reminder_at from public.todos where id = :'todo19_id'::uuid),
  '2026-09-19T09:00:00+00'::timestamptz,
  'リマインド日時を設定すると保存されること'
);

-- 一覧(calendar経由の結合)に反映される
select is(
  (select count(*) from public.todos t
     join public.events e on e.id = t.event_id
     where e.calendar_id = :'cal19_id'::uuid and t.reminder_at is not null),
  1::bigint,
  'リマインド日時を設定したToDoが一覧に反映されること'
);

-- 既存のToDoにも後から設定できる
insert into public.todos (event_id, title) values (:'event19_id', '会場を予約する') returning id \gset todo19b_
update public.todos set reminder_at = '2026-09-18T09:00:00+00' where id = :'todo19b_id'::uuid;

select is(
  (select reminder_at from public.todos where id = :'todo19b_id'::uuid),
  '2026-09-18T09:00:00+00'::timestamptz,
  '既存のToDoにも後からリマインド日時を設定できること'
);

select * from finish();
rollback;
