-- タスク9.1: todosスキーマと予定へのToDo追加を検証する

begin;
select plan(14);

select has_table('public', 'todos', 'todos テーブルが存在すること');
select has_column('public', 'todos', 'event_id', 'todos.event_id 列が存在すること');
select has_column('public', 'todos', 'title', 'todos.title 列が存在すること');
select has_column('public', 'todos', 'is_done', 'todos.is_done 列が存在すること');
select has_column('public', 'todos', 'completed_at', 'todos.completed_at 列が存在すること');
select col_is_pk('public', 'todos', 'id', 'todos.id が主キーであること');
select is(
  (select attnotnull from pg_attribute
     where attrelid = 'public.todos'::regclass and attname = 'event_id'),
  true,
  'todos.event_id が NOT NULL であること'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.todos'::regclass),
  true,
  'todos テーブルで RLS が有効であること'
);
-- 網羅的な一覧検証はタスク9.3(更新・削除ポリシー追加)以降で行うためここでは個別に存在確認する
select ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'todos' and policyname = 'todos_insert_member'
  ),
  'todos_insert_member ポリシーが定義されていること'
);
select ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'todos' and policyname = 'todos_select_member'
  ),
  'todos_select_member ポリシーが定義されていること'
);

-- セットアップ: owner + viewerが所属するカレンダーと予定
set local role postgres;
insert into auth.users (id) values
  ('77777777-8888-9999-0000-111111111111'), -- owner
  ('77777777-8888-9999-0000-111111111112'); -- viewer

set local role authenticated;
set local request.jwt.claim.sub = '77777777-8888-9999-0000-111111111111';
insert into public.calendars (name) values ('ToDo検証用') returning id \gset cal17_

set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role)
  values (:'cal17_id'::uuid, '77777777-8888-9999-0000-111111111112', 'viewer');

set local role authenticated;
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'cal17_id', 'ToDo検証予定', '2026-09-18T10:00:00+00', '2026-09-18T11:00:00+00')
  returning id \gset event17_

-- viewerがToDoを追加する
set local request.jwt.claim.sub = '77777777-8888-9999-0000-111111111112';
insert into public.todos (event_id, title) values (:'event17_id', '飲み物を買う');

select is(
  (select count(*) from public.todos where event_id = :'event17_id'::uuid),
  1::bigint,
  '追加したToDoが該当予定に紐づいて保存されること'
);

-- 他のカレンダーメンバーもToDoを閲覧できる
set local request.jwt.claim.sub = '77777777-8888-9999-0000-111111111111';
select is(
  (select count(*) from public.todos where event_id = :'event17_id'::uuid),
  1::bigint,
  '他のカレンダーメンバーもToDoを閲覧できること'
);

-- 非メンバーは閲覧・追加できない
set local role postgres;
insert into auth.users (id) values ('77777777-8888-9999-0000-111111111113');
set local role authenticated;
set local request.jwt.claim.sub = '77777777-8888-9999-0000-111111111113';
select is(
  (select count(*) from public.todos where event_id = :'event17_id'::uuid),
  0::bigint,
  '非メンバーはToDoを閲覧できないこと'
);
select throws_ok(
  $$ insert into public.todos (event_id, title) values (:'event17_id', '不正な追加') $$,
  '42501',
  null,
  '非メンバーはToDoを追加できないこと'
);

select * from finish();
rollback;
