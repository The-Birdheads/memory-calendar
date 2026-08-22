-- タスク11.4: NotificationDispatcher(毎分起動のリマインド配信)のpg_cronスケジュール

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- notification-dispatcher呼び出し時の簡易認証用共有シークレット。
-- <CRON_SECRET> はプレースホルダー(実値はリポジトリに含めない)。
-- Edge Function側は `supabase secrets set CRON_SECRET=...` で同じ値を設定済み。
-- 本番DBには既に実値を反映済みのため、この置き換え自体はDBに影響しない。
-- 環境を再構築する場合は、この文字列を実際のシークレット値に置き換えてから適用すること。
select cron.schedule(
  'notification-dispatcher-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://posqpbpfnmnnacqzkoxy.supabase.co/functions/v1/notification-dispatcher',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET>"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
