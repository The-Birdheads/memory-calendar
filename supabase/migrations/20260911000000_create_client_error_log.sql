-- クライアント(アプリ)側で捕捉した想定外エラーの記録先。
-- 本番でのクラッシュ/エラーに最低限の可視性を持たせるためのもの
-- (Sentry等の本格的なクラッシュレポートを入れるまでの措置)。
-- アプリからは「自分のエラーを記録する」INSERTのみ許可し、閲覧はしない
-- (開発者はダッシュボード / service role で参照する)。
create table public.client_error_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references public.profiles (id) on delete set null,
  message text not null,
  stack text,
  context text,
  platform text,
  app_version text,
  created_at timestamptz not null default now()
);

alter table public.client_error_log enable row level security;

create index client_error_log_created_at_idx on public.client_error_log (created_at desc);

-- 認証済みユーザーは自分のエラー行だけINSERTできる。SELECT/UPDATE/DELETEポリシーは
-- 定義しないため、クライアントからの閲覧・改変は一切できない。
create policy client_error_log_insert_own
  on public.client_error_log
  for insert
  to authenticated
  with check (user_id = auth.uid());
