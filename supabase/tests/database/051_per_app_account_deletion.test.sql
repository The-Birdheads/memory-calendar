-- Habitas / memory-calendar 共通アカウントの、アプリ別アカウント削除を検証する。
-- 他のアプリも使っていればそのアプリのデータだけ削除してアカウントを残し、
-- 使っていなければアカウントごと削除することを確認する。

begin;
select plan(25);

select has_function('public', 'register_app_use', array['text'], 'register_app_use(text) 関数が存在すること');
select has_function('public', 'delete_app_data', array['text'], 'delete_app_data(text) 関数が存在すること');
select has_function('public', 'get_account_usage', array[]::text[], 'get_account_usage() 関数が存在すること');
select is(
  (select relrowsecurity from pg_class where oid = 'public.app_usage'::regclass),
  true,
  'app_usage テーブルで RLS が有効であること'
);

-- セットアップ
set local role postgres;
insert into auth.users (id) values
  ('51000000-0000-0000-0000-000000000001'), -- U1: 両アプリを使う(Habitas → memory-calendar の順に削除)
  ('51000000-0000-0000-0000-000000000002'), -- U2: Habitasだけ使う
  ('51000000-0000-0000-0000-000000000003'), -- U3: 両アプリを使う(memory-calendar → 再利用)
  ('51000000-0000-0000-0000-000000000004'); -- U4: 利用記録が未登録のmemory-calendarユーザー

-- ---------- U1: 両アプリを使う ----------
set local role authenticated;
set local request.jwt.claim.sub = '51000000-0000-0000-0000-000000000001';
select public.register_app_use('memory_calendar');
select public.register_app_use('habitas');
insert into habitas.tasks (user_id, title, task_type)
  values ('51000000-0000-0000-0000-000000000001', '習慣', 'habit') returning id \gset t1_
insert into habitas.task_entries (user_id, day, task_id, status)
  values ('51000000-0000-0000-0000-000000000001', '2026-10-01', :'t1_id'::uuid, 'done');

select is(
  public.get_account_usage(),
  array['memory_calendar', 'habitas'],
  'U1: 両アプリの利用が返ること'
);

select is(public.delete_app_data('habitas'), false, 'U1: Habitasのデータ削除はアカウントを残す(false)');

set local role postgres;
select is(
  (select count(*) from habitas.tasks where user_id = '51000000-0000-0000-0000-000000000001')::int,
  0,
  'U1: Habitasのタスクが削除されること'
);
select is(
  (select count(*) from habitas.task_entries where user_id = '51000000-0000-0000-0000-000000000001')::int,
  0,
  'U1: Habitasの実施記録が削除されること'
);
select is(
  (select count(*) from auth.users where id = '51000000-0000-0000-0000-000000000001')::int,
  1,
  'U1: アカウントは残ること'
);
select is(
  (select count(*) from public.calendars
   where created_by = '51000000-0000-0000-0000-000000000001' and kind = 'personal')::int,
  1,
  'U1: memory-calendarの個人用カレンダーは残ること'
);
select is(
  (select array_agg(app order by app) from public.app_usage
   where user_id = '51000000-0000-0000-0000-000000000001'),
  array['memory_calendar'],
  'U1: 利用記録はmemory_calendarだけになること'
);

set local role authenticated;
set local request.jwt.claim.sub = '51000000-0000-0000-0000-000000000001';
select is(public.delete_app_data('memory_calendar'), true, 'U1: 最後のアプリの削除はアカウントごと削除する(true)');

set local role postgres;
select is(
  (select count(*) from auth.users where id = '51000000-0000-0000-0000-000000000001')::int,
  0,
  'U1: アカウントが削除されること'
);

-- ---------- U2: Habitasだけ使う ----------
set local role authenticated;
set local request.jwt.claim.sub = '51000000-0000-0000-0000-000000000002';
select public.register_app_use('habitas');
-- 充実度が未記入(null)でも保存できること
insert into habitas.daily_logs (user_id, day, note, fulfillment)
  values ('51000000-0000-0000-0000-000000000002', '2026-10-01', 'メモ', null);

select is(public.delete_app_data('habitas'), true, 'U2: Habitasだけの利用者はアカウントごと削除される(true)');

set local role postgres;
select is(
  (select count(*) from auth.users where id = '51000000-0000-0000-0000-000000000002')::int,
  0,
  'U2: アカウントが削除されること'
);
select is(
  (select count(*) from habitas.daily_logs where user_id = '51000000-0000-0000-0000-000000000002')::int,
  0,
  'U2: Habitasの振り返りが削除されること'
);

-- ---------- U3: memory-calendarのデータを削除してから再利用する ----------
set local role authenticated;
set local request.jwt.claim.sub = '51000000-0000-0000-0000-000000000003';
select public.register_app_use('memory_calendar');
select public.register_app_use('habitas');
insert into habitas.tasks (user_id, title, task_type)
  values ('51000000-0000-0000-0000-000000000003', '残る習慣', 'habit');

select is(public.delete_app_data('memory_calendar'), false, 'U3: memory-calendarのデータ削除はアカウントを残す(false)');

set local role postgres;
select is(
  (select count(*) from public.profiles where id = '51000000-0000-0000-0000-000000000003')::int,
  0,
  'U3: プロフィールが削除されること'
);
select is(
  (select count(*) from habitas.tasks where user_id = '51000000-0000-0000-0000-000000000003')::int,
  1,
  'U3: Habitasのデータは残ること'
);

set local role authenticated;
set local request.jwt.claim.sub = '51000000-0000-0000-0000-000000000003';
select public.register_app_use('memory_calendar');

set local role postgres;
select is(
  (select count(*) from public.profiles where id = '51000000-0000-0000-0000-000000000003')::int,
  1,
  'U3: 再利用時にプロフィールが作り直されること'
);
select is(
  (select count(*) from public.calendars
   where created_by = '51000000-0000-0000-0000-000000000003' and kind = 'personal')::int,
  1,
  'U3: 再利用時に個人用カレンダーが作り直されること'
);

-- ---------- U4: 利用記録が未登録でも、memory-calendarのデータがあれば使用中とみなす ----------
set local role authenticated;
set local request.jwt.claim.sub = '51000000-0000-0000-0000-000000000004';
insert into public.calendars (name) values ('U4の共有カレンダー') returning id \gset g4_
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'g4_id'::uuid, 'U4の予定', now(), now() + interval '1 hour');
select public.register_app_use('habitas');

select is(
  public.delete_app_data('habitas'),
  false,
  'U4: 利用記録が未登録でも、予定があればmemory-calendarの利用者として扱いアカウントを残す(false)'
);

set local role postgres;
select is(
  (select count(*) from auth.users where id = '51000000-0000-0000-0000-000000000004')::int,
  1,
  'U4: アカウントが残ること'
);

-- ---------- エラー ----------
set local role authenticated;
set local request.jwt.claim.sub = '51000000-0000-0000-0000-000000000004';
select throws_ok(
  $$ select public.delete_app_data('unknown') $$,
  'P0001',
  'unknown_app',
  '未知のアプリ名はエラーになること'
);

set local request.jwt.claim.sub = '';
select throws_ok(
  $$ select public.get_account_usage() $$,
  'P0001',
  'not_authenticated',
  '未ログインはエラーになること'
);

select * from finish();
rollback;
