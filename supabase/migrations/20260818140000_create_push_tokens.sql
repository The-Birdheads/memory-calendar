-- タスク11.1: push_tokensの登録(アプリ起動時のExpo Push Token取得・保存、ログアウト時の無効化)

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  expo_push_token text not null unique,
  device_info text,
  created_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;

create index push_tokens_user_id_idx on public.push_tokens (user_id);

-- push_tokens: 本人のトークンのみ閲覧・登録・削除できる(ログアウト時の無効化=削除)
create policy push_tokens_select_own
  on public.push_tokens
  for select
  to authenticated
  using (user_id = auth.uid());

create policy push_tokens_insert_own
  on public.push_tokens
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy push_tokens_update_own
  on public.push_tokens
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy push_tokens_delete_own
  on public.push_tokens
  for delete
  to authenticated
  using (user_id = auth.uid());
