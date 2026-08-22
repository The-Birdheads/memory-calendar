-- タスク11.2の補完: 新規予定追加(要件6.1)の通知を欠落させないためのDB Webhookトリガー追加
-- design.mdのEventChangeNotifierイベントコントラクトは
-- 「eventsテーブルのINSERT(series_id IS NULLの場合のみ処理)/UPDATE、event_commentsのINSERT」
-- と定めており、11.2実装時にUPDATEトリガーのみ作成しINSERTを見落としていたため追加する。

create trigger event_change_notifier_on_event_insert
  after insert on public.events
  for each row
  when (new.series_id is null)
  execute function supabase_functions.http_request(
    'https://posqpbpfnmnnacqzkoxy.supabase.co/functions/v1/event-change-notifier',
    'POST',
    '{"Content-Type":"application/json","x-webhook-secret":"<WEBHOOK_SECRET>"}',
    '{}',
    '5000'
  );
