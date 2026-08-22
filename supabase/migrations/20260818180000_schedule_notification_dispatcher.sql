-- タスク11.4: NotificationDispatcher(毎分起動のリマインド配信)のpg_cronスケジュール

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- notification-dispatcher呼び出し時の簡易認証用共有シークレット。
-- ローカル開発用の初期値。本番デプロイ前に、
--   1) `supabase secrets set CRON_SECRET=<十分にランダムな値>` でEdge Function側に設定し、
--   2) 下記のヘッダー値を同じシークレットに置き換える(またはVaultから読み込むよう変更する)
-- こと。値を変更せず本番運用しないこと。
select cron.schedule(
  'notification-dispatcher-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'http://host.docker.internal:54321/functions/v1/notification-dispatcher',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "local-dev-cron-secret-change-me"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
