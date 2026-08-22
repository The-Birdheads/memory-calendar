-- タスク1.2: RLS共通ヘルパーとprofilesテーブル

-- カレンダーメンバーシップ判定ヘルパー(SECURITY DEFINERでRLSポリシー内の再帰評価コストを避ける)
-- calendar_members テーブルはタスク3.1で作成される。plpgsql本体はCREATE FUNCTION時点で
-- オブジェクト参照を解決しない(初回呼び出し時まで遅延される)ため、先行して定義できる。
create or replace function public.is_calendar_member(p_calendar_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1
    from public.calendar_members cm
    where cm.calendar_id = p_calendar_id
      and cm.user_id = p_user_id
  );
end;
$$;

revoke all on function public.is_calendar_member(uuid, uuid) from public;
grant execute on function public.is_calendar_member(uuid, uuid) to anon, authenticated;

-- 更新日時を自動更新する共通トリガー関数(以降の全テーブルで再利用する)
create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- profiles: auth.users と1:1で連携するユーザープロフィール
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_current_timestamp_updated_at();

-- カレンダー共有機能上、他メンバーの表示名を閲覧する必要があるため認証済みユーザー全体に読み取りを許可する
create policy profiles_select_authenticated
  on public.profiles
  for select
  to authenticated
  using (true);

create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- auth.users 作成時に profiles 行を自動生成する
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
