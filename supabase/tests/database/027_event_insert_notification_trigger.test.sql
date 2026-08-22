-- タスク11.2の補完: 新規予定追加のDB Webhookトリガーが定義されていることを検証する

begin;
select plan(1);

select has_trigger(
  'public', 'events', 'event_change_notifier_on_event_insert',
  'events テーブルに新規予定追加通知用のDB Webhookトリガーが定義されていること'
);

select * from finish();
rollback;
