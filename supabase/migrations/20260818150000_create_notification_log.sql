-- タスク11.2: notification_logスキーマ(冪等性キー)と変更・コメント通知のDB Webhook

create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  target_user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  todo_id uuid references public.todos (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- notification_logはEdge Functions(service role)専用のテーブルであり、
-- クライアントからの直接アクセスは想定しない。RLSを有効化した上でポリシーを
-- 一切定義しないことで、authenticated/anonロールからのアクセスをデフォルト拒否する。
-- service role鍵はRLSを常にバイパスするため、Edge Functionからの読み書きには影響しない。
alter table public.notification_log enable row level security;

-- 冪等性キー: event起点の通知(todo_idなし)とtodo起点の通知(event_idなし)を
-- それぞれ部分一意インデックスで表現する(NULL同士は非等価とみなされるPostgresの挙動を避けるため)
create unique index notification_log_event_idempotency_key
  on public.notification_log (type, target_user_id, event_id)
  where event_id is not null and todo_id is null;

create unique index notification_log_todo_idempotency_key
  on public.notification_log (type, target_user_id, todo_id)
  where todo_id is not null;

create index notification_log_target_user_id_idx on public.notification_log (target_user_id);

-- DB Webhook: events(series_id IS NULLの単発予定のみ)のUPDATE、event_commentsのINSERTを起点に
-- event-change-notifier Edge Functionを呼び出す。
create trigger event_change_notifier_on_event_update
  after update on public.events
  for each row
  when (new.series_id is null)
  execute function supabase_functions.http_request(
    'https://posqpbpfnmnnacqzkoxy.supabase.co/functions/v1/event-change-notifier',
    'POST',
    '{"Content-Type":"application/json","x-webhook-secret":"<WEBHOOK_SECRET>"}',
    '{}',
    '5000'
  );

create trigger event_change_notifier_on_comment_insert
  after insert on public.event_comments
  for each row
  execute function supabase_functions.http_request(
    'https://posqpbpfnmnnacqzkoxy.supabase.co/functions/v1/event-change-notifier',
    'POST',
    '{"Content-Type":"application/json","x-webhook-secret":"<WEBHOOK_SECRET>"}',
    '{}',
    '5000'
  );
