-- タスク17.1: EventChangeNotifierへの削除通知の追加(要件6.7)

-- notification_log.event_idは削除済みイベントのidをそのまま冪等性キーとして記録する必要があるため、
-- events(id)へのFK制約を外す(列自体・既存の一意制約/インデックス構成は変更しない)
alter table public.notification_log
  drop constraint notification_log_event_id_fkey;

-- DB Webhook: events の DELETE を起点に event-change-notifier Edge Function を呼び出す。
-- old_record から削除前の calendar_id を取得して対象カレンダーの他メンバーへ通知する。
create trigger event_change_notifier_on_event_delete
  after delete on public.events
  for each row
  execute function supabase_functions.http_request(
    'https://posqpbpfnmnnacqzkoxy.supabase.co/functions/v1/event-change-notifier',
    'POST',
    '{"Content-Type":"application/json","x-webhook-secret":"<WEBHOOK_SECRET>"}',
    '{}',
    '5000'
  );
