-- Habitas / memory-calendar 共通アカウント: アプリ別のアカウント削除(設計ドラフト)
-- ⚠️ まだどの環境にも適用していない。20260921000000_habitas_integration_schema.sql の後に適用すること。
--
-- 方針:
--   「アカウント削除」を押したアプリのデータだけを削除する。
--   他のアプリも使っていればアカウント(auth.users)は残し、使っていなければアカウントごと削除する。
--
-- 「他のアプリを使っているか」の判定:
--   handle_new_user は全ての新規ユーザーに profiles と個人用カレンダーを作る。
--   そのため「profilesがある = memory-calendarを使っている」とは言えない。
--   アプリごとの利用記録 public.app_usage を持ち、各アプリが初回ログイン時に
--   register_app_use() で登録する。
--   登録漏れ(アプリ更新前に作られたアカウント等)で誤ってアカウントごと消さないよう、
--   実データがあれば「使っている」とみなす保険(_app_in_use)も入れている。
--
-- 既存のmemory-calendarアプリ(v1.0.2)は delete_own_account() を呼ぶため、
-- この関数は残し、中身を「memory_calendarのデータ削除」に置き換える。

-- ============================================================
-- 1. app_usage
-- ============================================================
create table public.app_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  app text not null check (app in ('memory_calendar', 'habitas')),
  first_used_at timestamptz not null default now(),
  primary key (user_id, app)
);

alter table public.app_usage enable row level security;

create policy app_usage_select_own
  on public.app_usage
  for select
  to authenticated
  using (user_id = auth.uid());

-- 書き込みはSECURITY DEFINER関数(register_app_use / delete_app_data)経由のみ
revoke all on public.app_usage from anon, authenticated;
grant select on public.app_usage to authenticated;

-- 既存のmemory-calendarユーザーを登録する。
-- (Habitasのユーザーは、データ移行スクリプトで 'habitas' を登録する)
insert into public.app_usage (user_id, app)
select id, 'memory_calendar' from public.profiles
on conflict do nothing;

-- ============================================================
-- 2. 利用状況の判定
-- ============================================================
create or replace function public._app_in_use(p_uid uuid, p_app text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (select 1 from public.app_usage where user_id = p_uid and app = p_app)
    or (
      p_app = 'memory_calendar'
      and (
        exists (select 1 from public.events where created_by = p_uid)
        or exists (
          select 1
          from public.calendar_members m
          join public.calendars c on c.id = m.calendar_id
          where m.user_id = p_uid and c.kind = 'group'
        )
      )
    )
    or (
      p_app = 'habitas'
      and exists (select 1 from habitas.tasks where user_id = p_uid)
    );
$$;

revoke all on function public._app_in_use(uuid, text) from public;

-- アプリ側が確認画面の文言を出し分けるために使う(自分の利用アプリ一覧)。
create or replace function public.get_account_usage()
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_apps text[] := '{}';
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if public._app_in_use(v_uid, 'memory_calendar') then
    v_apps := array_append(v_apps, 'memory_calendar');
  end if;
  if public._app_in_use(v_uid, 'habitas') then
    v_apps := array_append(v_apps, 'habitas');
  end if;
  return v_apps;
end;
$$;

revoke all on function public.get_account_usage() from public;
grant execute on function public.get_account_usage() to authenticated;

-- ============================================================
-- 3. 初回利用の登録
-- ============================================================
-- 各アプリがログイン直後に呼ぶ。冪等。
-- memory_calendar のデータ削除でプロフィールを消している場合は、
-- プロフィールと個人用カレンダーを作り直す(handle_new_user は新規作成時にしか動かないため)。
create or replace function public.register_app_use(p_app text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_app not in ('memory_calendar', 'habitas') then
    raise exception 'unknown_app';
  end if;

  if p_app = 'memory_calendar' then
    insert into public.profiles (id, display_name)
    select
      u.id,
      coalesce(
        u.raw_user_meta_data ->> 'display_name',
        u.raw_user_meta_data ->> 'full_name',
        u.raw_user_meta_data ->> 'name'
      )
    from auth.users u
    where u.id = v_uid
    on conflict (id) do nothing;

    if not exists (
      select 1 from public.calendars where created_by = v_uid and kind = 'personal'
    ) then
      insert into public.calendars (name, kind, created_by)
      values ('Myカレンダー', 'personal', v_uid);
    end if;
  end if;

  insert into public.app_usage (user_id, app)
  values (v_uid, p_app)
  on conflict do nothing;
end;
$$;

revoke all on function public.register_app_use(text) from public;
grant execute on function public.register_app_use(text) to authenticated;

-- ============================================================
-- 4. アプリ別のデータ削除(内部用)
-- ============================================================
-- いずれも呼び出し元(auth.uid())自身のデータを対象にする。冪等。
create or replace function public._delete_memory_calendar_data(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_calendar_id uuid;
begin
  -- 1. 個人用カレンダー(本人専用領域)はまるごと削除する
  --    (配下の予定・写真・コメント・タグ紐付け・リマインドは on delete cascade)
  delete from public.calendars where created_by = p_uid and kind = 'personal';

  -- 2. 参加中の共有カレンダーは leave_or_delete_calendar と同じ規則で後始末する
  --    (この関数は内部で auth.uid() を使うため、呼び出し側はJWTクレームを外す前に呼ぶこと)
  for v_calendar_id in
    select calendar_id from public.calendar_members where user_id = p_uid
  loop
    perform public.leave_or_delete_calendar(v_calendar_id);
  end loop;
end;
$$;

revoke all on function public._delete_memory_calendar_data(uuid) from public;

create or replace function public._delete_habitas_data(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public, habitas
as $$
begin
  -- task_entries / action_entries は tasks / actions からの on delete cascade でも消えるが、
  -- 明示して順序に依存しないようにする
  delete from habitas.task_entries where user_id = p_uid;
  delete from habitas.action_entries where user_id = p_uid;
  delete from habitas.tasks where user_id = p_uid;
  delete from habitas.actions where user_id = p_uid;
  delete from habitas.daily_logs where user_id = p_uid;
  delete from habitas.notification_settings where user_id = p_uid;
  delete from habitas.user_profiles where user_id = p_uid;
end;
$$;

revoke all on function public._delete_habitas_data(uuid) from public;

-- ============================================================
-- 5. アプリ別のアカウント削除
-- ============================================================
-- 戻り値: true = アカウント(auth.users)ごと削除した / false = このアプリのデータだけ削除した
-- 呼び出し元アプリは、成功後に必ずクライアント側でも signOut すること
-- (auth.users を直接DELETEしても、既存のアクセストークンは期限まで通り得るため)。
create or replace function public.delete_app_data(p_app text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_other text;
  v_other_in_use boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_app not in ('memory_calendar', 'habitas') then
    raise exception 'unknown_app';
  end if;

  v_other := case p_app when 'memory_calendar' then 'habitas' else 'memory_calendar' end;
  -- 他アプリの利用有無は、このアプリのデータを消す前に判定する
  v_other_in_use := public._app_in_use(v_uid, v_other);

  if p_app = 'memory_calendar' then
    perform public._delete_memory_calendar_data(v_uid);
  else
    perform public._delete_habitas_data(v_uid);
  end if;

  delete from public.app_usage where user_id = v_uid and app = p_app;

  if v_other_in_use then
    -- 他のアプリも使っている: アカウントは残す
    if p_app = 'memory_calendar' then
      -- profiles を消すと、ToDo/タグ/スタンプ/リマインド設定/Pushトークンなどの
      -- 完全プライベートなデータが連鎖削除される(共有カレンダーのコンテンツは set null で残る)。
      -- events の連鎖UPDATEで BEFORE トリガーが updated_by を打刻し直さないよう、
      -- 先にJWTクレームを外す(20260910030000 と同じ理由)。
      perform set_config('request.jwt.claim.sub', '', true);
      perform set_config('request.jwt.claims', '', true);
      delete from public.profiles where id = v_uid;
    end if;
    return false;
  end if;

  -- 他に使っているアプリがない: アカウントごと削除する。
  -- handle_new_user は全ユーザーに個人用カレンダーを作るため、
  -- 使っていない側のアプリの残りも片付けてから auth.users を消す。
  perform public._delete_memory_calendar_data(v_uid);
  perform public._delete_habitas_data(v_uid);

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  delete from auth.users where id = v_uid;
  return true;
end;
$$;

revoke all on function public.delete_app_data(text) from public;
grant execute on function public.delete_app_data(text) to authenticated;

-- ============================================================
-- 6. 既存アプリ(memory-calendar v1.0.2)との互換
-- ============================================================
-- 既存アプリは delete_own_account() を呼ぶ。「memory_calendarのデータ削除」として動かす。
-- Habitasも使っていなければ、従来どおりアカウントごと削除される。
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.delete_app_data('memory_calendar');
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
