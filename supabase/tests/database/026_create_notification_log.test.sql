-- タスク11.2: notification_logスキーマ(冪等性キー)とDB Webhookトリガーを検証する

begin;
select plan(10);

select has_table('public', 'notification_log', 'notification_log テーブルが存在すること');
select has_column('public', 'notification_log', 'type', 'notification_log.type 列が存在すること');
select has_column('public', 'notification_log', 'target_user_id', 'notification_log.target_user_id 列が存在すること');
select has_column('public', 'notification_log', 'event_id', 'notification_log.event_id 列が存在すること');
select has_column('public', 'notification_log', 'todo_id', 'notification_log.todo_id 列が存在すること');
select is(
  (select relrowsecurity from pg_class where oid = 'public.notification_log'::regclass),
  true,
  'notification_log テーブルで RLS が有効であること'
);
select policies_are(
  'public', 'notification_log',
  array[]::text[],
  'notification_log にはクライアント向けRLSポリシーが定義されていないこと(service role専用)'
);

select has_trigger(
  'public', 'events', 'event_change_notifier_on_event_update',
  'events テーブルに変更通知用のDB Webhookトリガーが定義されていること'
);
select has_trigger(
  'public', 'event_comments', 'event_change_notifier_on_comment_insert',
  'event_comments テーブルにコメント通知用のDB Webhookトリガーが定義されていること'
);

-- 冪等性キー: 同一(type, target_user_id, event_id)の重複INSERTは一意制約で拒否される
set local role postgres;
insert into auth.users (id) values ('55555555-5555-6666-7777-888888888881');
insert into public.calendars (name, created_by) values ('通知検証用', '55555555-5555-6666-7777-888888888881') returning id \gset cal23_
insert into public.events (calendar_id, title, start_at, end_at, created_by, updated_by)
  values (:'cal23_id', '通知検証予定', '2026-09-21T10:00:00+00', '2026-09-21T11:00:00+00',
          '55555555-5555-6666-7777-888888888881', '55555555-5555-6666-7777-888888888881')
  returning id \gset event23_

insert into public.notification_log (type, target_user_id, event_id, status)
  values ('event_updated', '55555555-5555-6666-7777-888888888881', :'event23_id', 'sent');

select throws_ok(
  format(
    $$ insert into public.notification_log (type, target_user_id, event_id, status)
       values ('event_updated', '55555555-5555-6666-7777-888888888881', %L, 'sent') $$,
    :'event23_id'
  ),
  '23505',
  null,
  '同一(type, target_user_id, event_id)の重複記録は一意制約で拒否されること(冪等性)'
);

select * from finish();
rollback;
