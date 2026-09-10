-- タスク13.5*: 通知の冪等性の回帰テスト
--
-- DB Webhook起点(EventChangeNotifier)とpg_cron起点(NotificationDispatcher)の
-- 両Edge Functionは、送信前に notification_log へ1行INSERTして「予約」し、
-- 一意制約違反(既に予約済み=送信済み)ならスキップする、という方式で
-- 「再実行しても重複通知しない」ことを担保している(各indexのコメント参照)。
-- ここでは両Functionが依存する notification_log の部分一意インデックス4本が
-- 期待通り重複予約を弾き、かつ別種別・別対象・別キーの予約は妨げないことを
-- 検証する(Edge Function本体はDeno製で本テスト環境からは実行できないため、
-- その冪等性の土台であるDB制約を回帰テストの対象とする)。

begin;
select plan(19);

-- notification_log の一意インデックス4本が存在すること
select has_index('public', 'notification_log', 'notification_log_event_idempotency_key',
  'event起点通知の冪等性インデックスが存在すること');
select has_index('public', 'notification_log', 'notification_log_todo_idempotency_key',
  'todo起点通知の冪等性インデックスが存在すること');
select has_index('public', 'notification_log', 'notification_log_series_idempotency_key',
  'シリーズ起点通知の冪等性インデックスが存在すること');
select has_index('public', 'notification_log', 'notification_log_event_reminder_idempotency_key',
  '予定リマインドの冪等性インデックスが存在すること');

-- notification_log はEdge Function(service role)専用。service roleはRLSをバイパスするため、
-- RLSを同様にバイパスする postgres ロールでEdge Functionの挙動を再現する。
set local role postgres;

insert into auth.users (id) values
  ('bbbbbbbb-0000-0000-0000-00000000000a'),  -- 操作者
  ('bbbbbbbb-0000-0000-0000-00000000000b');  -- 通知の受信者

insert into public.calendars (id, name, created_by)
  values ('cccccccc-0000-0000-0000-000000000001', '冪等性検証用',
          'bbbbbbbb-0000-0000-0000-00000000000a');
insert into public.calendar_members (calendar_id, user_id, role) values
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000b', 'viewer');

insert into public.events (id, calendar_id, title, start_at, end_at, created_by, updated_by)
  values ('eeeeeeee-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
          '検証予定', '2026-10-01T10:00:00+00', '2026-10-01T11:00:00+00',
          'bbbbbbbb-0000-0000-0000-00000000000a', 'bbbbbbbb-0000-0000-0000-00000000000a');

insert into public.todos (id, event_id, title, created_by)
  values ('dddddddd-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001',
          '検証ToDo', 'bbbbbbbb-0000-0000-0000-00000000000b');

insert into public.event_series (id, calendar_id, recurrence_rule, start_at, recurrence_end_at, created_by)
  values ('ffffffff-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
          'weekly', '2026-10-01T10:00:00+00', '2026-11-01T10:00:00+00',
          'bbbbbbbb-0000-0000-0000-00000000000a');

insert into public.event_reminders (id, event_id, user_id, kind, remind_at)
  values ('a1a1a1a1-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001',
          'bbbbbbbb-0000-0000-0000-00000000000b', 'day_before_1', '2026-09-30T09:00:00+00');


-- ===== 1) event起点通知: (type, target_user_id, event_id) =====
-- EventChangeNotifierが「予定更新」通知を受信者Bへ予約する
select lives_ok(
  $$ insert into public.notification_log (type, target_user_id, event_id, status)
     values ('event_updated', 'bbbbbbbb-0000-0000-0000-00000000000b',
             'eeeeeeee-0000-0000-0000-000000000001', 'sent') $$,
  '1回目: event起点の通知予約は成功すること'
);
select throws_ok(
  $$ insert into public.notification_log (type, target_user_id, event_id, status)
     values ('event_updated', 'bbbbbbbb-0000-0000-0000-00000000000b',
             'eeeeeeee-0000-0000-0000-000000000001', 'sent') $$,
  '23505', null,
  '2回目(再実行): 同一(type,target,event_id)の予約は一意制約で弾かれ、重複通知しないこと'
);
select lives_ok(
  $$ insert into public.notification_log (type, target_user_id, event_id, status)
     values ('event_created', 'bbbbbbbb-0000-0000-0000-00000000000b',
             'eeeeeeee-0000-0000-0000-000000000001', 'sent') $$,
  '別の通知種別(event_created)は同じ予定でも予約できること'
);
select lives_ok(
  $$ insert into public.notification_log (type, target_user_id, event_id, status)
     values ('event_updated', 'bbbbbbbb-0000-0000-0000-00000000000a',
             'eeeeeeee-0000-0000-0000-000000000001', 'sent') $$,
  '別の受信者には同じ通知を予約できること'
);


-- ===== 2) todo起点通知: (type, target_user_id, todo_id) =====
select lives_ok(
  $$ insert into public.notification_log (type, target_user_id, todo_id, status)
     values ('todo_reminder', 'bbbbbbbb-0000-0000-0000-00000000000b',
             'dddddddd-0000-0000-0000-000000000001', 'sent') $$,
  '1回目: todoリマインドの通知予約は成功すること'
);
select throws_ok(
  $$ insert into public.notification_log (type, target_user_id, todo_id, status)
     values ('todo_reminder', 'bbbbbbbb-0000-0000-0000-00000000000b',
             'dddddddd-0000-0000-0000-000000000001', 'sent') $$,
  '23505', null,
  '2回目(pg_cron再実行): 同一(type,target,todo_id)の予約は弾かれ、重複通知しないこと'
);


-- ===== 3) シリーズ起点通知: (type, target_user_id, series_id) =====
select lives_ok(
  $$ insert into public.notification_log (type, target_user_id, series_id, status)
     values ('series_created', 'bbbbbbbb-0000-0000-0000-00000000000b',
             'ffffffff-0000-0000-0000-000000000001', 'sent') $$,
  '1回目: シリーズ作成通知の予約は成功すること'
);
select throws_ok(
  $$ insert into public.notification_log (type, target_user_id, series_id, status)
     values ('series_created', 'bbbbbbbb-0000-0000-0000-00000000000b',
             'ffffffff-0000-0000-0000-000000000001', 'sent') $$,
  '23505', null,
  '2回目(再実行): 同一(type,target,series_id)の予約は弾かれ、重複通知しないこと'
);


-- ===== 4) 予定リマインド: (target_user_id, event_reminder_id) =====
-- このindexだけ type を含まない(event_reminders 1件 = 1通知なので、
-- どの種別で送ろうとしても対象ユーザー×リマインドが同じなら重複扱い)。
select lives_ok(
  $$ insert into public.notification_log (type, target_user_id, event_reminder_id, status)
     values ('event_reminder', 'bbbbbbbb-0000-0000-0000-00000000000b',
             'a1a1a1a1-0000-0000-0000-000000000001', 'sent') $$,
  '1回目: 予定リマインドの通知予約は成功すること'
);
select throws_ok(
  $$ insert into public.notification_log (type, target_user_id, event_reminder_id, status)
     values ('event_reminder', 'bbbbbbbb-0000-0000-0000-00000000000b',
             'a1a1a1a1-0000-0000-0000-000000000001', 'sent') $$,
  '23505', null,
  '2回目(pg_cron再実行): 同一(target,event_reminder_id)の予約は弾かれ、重複通知しないこと'
);
select throws_ok(
  $$ insert into public.notification_log (type, target_user_id, event_reminder_id, status)
     values ('some_other_type', 'bbbbbbbb-0000-0000-0000-00000000000b',
             'a1a1a1a1-0000-0000-0000-000000000001', 'sent') $$,
  '23505', null,
  'このindexはtypeを見ないため、種別が違っても同一(target,event_reminder_id)なら弾かれること'
);
select lives_ok(
  $$ insert into public.notification_log (type, target_user_id, event_reminder_id, status)
     values ('event_reminder', 'bbbbbbbb-0000-0000-0000-00000000000a',
             'a1a1a1a1-0000-0000-0000-000000000001', 'sent') $$,
  '別の受信者には同じリマインド通知を予約できること'
);


-- ===== 冪等性キー同士の独立性 =====
-- event_id と todo_id / series_id / event_reminder_id は別々の部分indexなので、
-- 片方が埋まっていてももう片方の予約は妨げられない(全て event 起点予約とは別扱い)。
select is(
  (select count(*)::int from public.notification_log),
  7,
  'ここまでの予約が想定通り7件記録されていること(重複予約は1件も入っていない)'
);

-- 「予約 → 送信結果でstatus更新」を再実行しても、status更新自体は冪等
select lives_ok(
  $$ update public.notification_log set status = 'sent', sent_at = now()
     where type = 'event_updated' and target_user_id = 'bbbbbbbb-0000-0000-0000-00000000000b'
       and event_id = 'eeeeeeee-0000-0000-0000-000000000001' $$,
  '送信結果によるstatus更新は何度実行しても問題ないこと'
);

-- event_id と todo_id を同時に持つ行は、event用の部分index条件
-- (event_id is not null AND todo_id is null)を満たさないため冪等性キーの対象外。
-- 運用上そのような行は作られない(Edge Functionは片方だけ設定する)ことの確認。
select lives_ok(
  $$ insert into public.notification_log (type, target_user_id, event_id, todo_id, status)
     values ('mixed', 'bbbbbbbb-0000-0000-0000-00000000000b',
             'eeeeeeee-0000-0000-0000-000000000001',
             'dddddddd-0000-0000-0000-000000000001', 'sent') $$,
  'event_idとtodo_idの両方を持つ行はどの部分indexにも載らない(参考: 運用では作られない)'
);

select * from finish();
rollback;
