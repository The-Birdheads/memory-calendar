-- タスク11.4: NotificationDispatcherのpg_cronスケジュールと配信対象解決ロジックの前提を検証する

begin;
select plan(8);

select has_extension('pg_cron', 'pg_cron拡張が有効であること');
select has_extension('pg_net', 'pg_net拡張が有効であること');

select ok(
  exists(
    select 1 from cron.job
    where jobname = 'notification-dispatcher-every-minute'
      and schedule = '* * * * *'
  ),
  'notification-dispatcherが毎分(* * * * *)起動するようスケジュールされていること'
);

-- セットアップ: owner + 2名のメンバーが所属するカレンダーとリマインド対象の予定・ToDo
set local role postgres;
insert into auth.users (id) values
  ('77777777-7777-8888-9999-000000000001'), -- owner
  ('77777777-7777-8888-9999-000000000002'), -- member2(対象者に指定)
  ('77777777-7777-8888-9999-000000000003'); -- member3(対象者に指定しない)

set local role authenticated;
set local request.jwt.claim.sub = '77777777-7777-8888-9999-000000000001';
insert into public.calendars (name) values ('リマインド配信検証用') returning id \gset cal25_

set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role) values
  (:'cal25_id'::uuid, '77777777-7777-8888-9999-000000000002', 'viewer'),
  (:'cal25_id'::uuid, '77777777-7777-8888-9999-000000000003', 'viewer');

set local role authenticated;
insert into public.events (calendar_id, title, start_at, end_at, reminder_at)
  values (:'cal25_id', '対象者限定リマインド予定', '2026-09-22T10:00:00+00', '2026-09-22T11:00:00+00', now() - interval '1 minute')
  returning id \gset event25_
insert into public.event_reminder_targets (event_id, user_id)
  values (:'event25_id', '77777777-7777-8888-9999-000000000002');

insert into public.events (calendar_id, title, start_at, end_at, reminder_at)
  values (:'cal25_id', '全員対象リマインド予定', '2026-09-23T10:00:00+00', '2026-09-23T11:00:00+00', now() - interval '1 minute')
  returning id \gset event25b_

-- 対象者が設定されている場合は、その対象者のみが配信対象として解決される
select is(
  (select count(*) from public.event_reminder_targets where event_id = :'event25_id'::uuid),
  1::bigint,
  '対象者を設定した予定はevent_reminder_targetsに1件のみ存在すること'
);
select is(
  (select user_id from public.event_reminder_targets where event_id = :'event25_id'::uuid),
  '77777777-7777-8888-9999-000000000002'::uuid,
  '設定した対象者(member2)のみが配信対象として解決されること'
);

-- 対象者未設定の予定は、カレンダーの全メンバー(3名)が配信対象とみなされる
select is(
  (select count(*) from public.event_reminder_targets where event_id = :'event25b_id'::uuid),
  0::bigint,
  '対象者未設定の予定はevent_reminder_targetsが0件であること(全メンバーが対象とみなされる前提)'
);
select is(
  (select count(*) from public.calendar_members where calendar_id = :'cal25_id'::uuid),
  3::bigint,
  '対象者未設定時にフォールバックする全メンバー数が3名であること'
);

-- notification_log: todo_idをキーとした冪等性(再実行しても重複配信されない)
set local role postgres;
insert into public.todos (event_id, title, reminder_at)
  values (:'event25_id', 'リマインド検証ToDo', now() - interval '1 minute')
  returning id \gset todo25_
insert into public.notification_log (type, target_user_id, todo_id, status)
  values ('todo_reminder', '77777777-7777-8888-9999-000000000002', :'todo25_id', 'sent');

select throws_ok(
  $$ insert into public.notification_log (type, target_user_id, todo_id, status)
     values ('todo_reminder', '77777777-7777-8888-9999-000000000002', :'todo25_id', 'sent') $$,
  '23505',
  null,
  'todo_idをキーとした重複記録(再実行時の重複配信)は一意制約で拒否されること'
);

select * from finish();
rollback;
