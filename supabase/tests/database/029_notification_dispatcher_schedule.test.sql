-- タスク11.4: NotificationDispatcherのpg_cronスケジュールと配信対象解決ロジックの前提を検証する
-- (event_reminders移行後: 「対象者」ではなく各メンバーが自分で設定したevent_remindersの行そのものが配信対象)

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
  ('77777777-7777-8888-9999-000000000002'), -- member2(自分でリマインドを2件設定)
  ('77777777-7777-8888-9999-000000000003'); -- member3(リマインドを設定しない)

set local role authenticated;
set local request.jwt.claim.sub = '77777777-7777-8888-9999-000000000001';
insert into public.calendars (name) values ('リマインド配信検証用') returning id \gset cal25_

set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role) values
  (:'cal25_id'::uuid, '77777777-7777-8888-9999-000000000002', 'viewer'),
  (:'cal25_id'::uuid, '77777777-7777-8888-9999-000000000003', 'viewer');

set local role authenticated;
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'cal25_id', '個人リマインド検証予定', '2026-09-22T10:00:00+00', '2026-09-22T11:00:00+00')
  returning id \gset event25_

-- member2が自分の意思で「開始時」「10分前」の2件を設定する(対象者選択ではなく自己設定)
set local request.jwt.claim.sub = '77777777-7777-8888-9999-000000000002';
insert into public.event_reminders (event_id, kind)
  values (:'event25_id', 'at_start')
  returning id \gset reminder25a_
insert into public.event_reminders (event_id, kind)
  values (:'event25_id', 'before_10m')
  returning id \gset reminder25b_

-- member3はリマインドを何も設定していない = 配信対象にならない(全員対象フォールバックは廃止)
select is(
  (select count(*) from public.event_reminders where event_id = :'event25_id'::uuid),
  2::bigint,
  '自分で設定した2件のみがevent_remindersに存在すること(他人の分は増えない)'
);
select is(
  (select count(*) from public.event_reminders where event_id = :'event25_id'::uuid and user_id = '77777777-7777-8888-9999-000000000003'::uuid),
  0::bigint,
  'リマインドを設定していないmember3は配信対象として存在しないこと(全員対象フォールバックは廃止)'
);

-- notification_log: event_reminder_idをキーとした冪等性(同じ予定でも複数リマインドはそれぞれ配信され、
-- 同一リマインドの再実行では重複配信されない)
set local role postgres;
insert into public.notification_log (type, target_user_id, event_reminder_id, status)
  values ('event_reminder', '77777777-7777-8888-9999-000000000002', :'reminder25a_id', 'sent');
insert into public.notification_log (type, target_user_id, event_reminder_id, status)
  values ('event_reminder', '77777777-7777-8888-9999-000000000002', :'reminder25b_id', 'sent');

select is(
  (select count(*) from public.notification_log where target_user_id = '77777777-7777-8888-9999-000000000002'::uuid),
  2::bigint,
  '同じ予定でも別々のevent_reminder(開始時/10分前)はそれぞれ配信記録されること'
);

select throws_ok(
  format(
    $$ insert into public.notification_log (type, target_user_id, event_reminder_id, status)
       values ('event_reminder', %L, %L, 'sent') $$,
    '77777777-7777-8888-9999-000000000002'::uuid,
    :'reminder25a_id'::uuid
  ),
  '23505',
  null,
  'event_reminder_idをキーとした重複記録(再実行時の重複配信)は一意制約で拒否されること'
);

-- notification_log: todo_idをキーとした冪等性(再実行しても重複配信されない、従来通り)
insert into public.todos (event_id, title, reminder_at)
  values (:'event25_id', 'リマインド検証ToDo', now() - interval '1 minute')
  returning id \gset todo25_
insert into public.notification_log (type, target_user_id, todo_id, status)
  values ('todo_reminder', '77777777-7777-8888-9999-000000000002', :'todo25_id', 'sent');

select throws_ok(
  format(
    $$ insert into public.notification_log (type, target_user_id, todo_id, status)
       values ('todo_reminder', %L, %L, 'sent') $$,
    '77777777-7777-8888-9999-000000000002'::uuid,
    :'todo25_id'::uuid
  ),
  '23505',
  null,
  'todo_idをキーとした重複記録(再実行時の重複配信)は一意制約で拒否されること'
);

select * from finish();
rollback;
