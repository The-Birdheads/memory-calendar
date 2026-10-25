-- Habitas(life-osリポジトリ)統合: 設計ドラフト
-- ⚠️ このマイグレーションはまだHabitas/memory-calendarどちらの本番DBにも
-- 適用していない。(2026-10-24 改訂: Habitasアプリの同期コード(life-os
-- src/lib/db/sqliteRepository.ts)が実際に読み書きする列・onConflict指定に合わせて、
-- deleted_at / updated_at 列、一意制約、API用のGRANTを追加した。)実行前に必ずレビューし、特に以下の前提を確認すること:
--   - 進捗の「対象日」は tasks.due_date (無ければ当日) としている
--     (habitas.tasksとhabitas.task_entriesの元の1:多関係のうち、ToDo連携が
--     意味を持つのはtask_type='oneoff'の単発タスクのみを想定しているため)
--   - Habitas側の既存データはuser_idがtext型なので、実データ移行時は
--     user_id::uuid へキャストしてこのスキーマへコピーする
--   - Supabaseダッシュボードの Settings > API > Exposed schemas に
--     `habitas` を追加しないと、PostgREST経由でこのスキーマにアクセスできない
--     (SQLだけでは完結しない設定)

-- ============================================================
-- 1. スキーマ作成
-- ============================================================
create schema if not exists habitas;

-- ============================================================
-- 2. Habitasのテーブル
-- ============================================================
-- 元のHabitas(life-os)側ではuser_idがtext型(auth.uid()::text比較)だったが、
-- 同一プロジェクトでauth.usersと確実に整合させるためuuidに統一する。

create table habitas.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  task_type text not null check (task_type in ('habit', 'oneoff')),
  due_date date,
  is_active boolean not null default true,
  is_hidden boolean not null default false,
  priority integer not null default 0,
  volume integer not null default 0,
  memo text,
  remind_on boolean not null default false,
  remind_hour integer,
  remind_minute integer,
  -- memory-calendarのToDoとの任意連携(2026-09、Habitas/memory-calendar統合)。
  -- 意味を持つのはtask_type='oneoff'のタスクのみを想定
  -- (habitは日次反復のため単一のToDoと1:1対応しない)。
  linked_todo_id uuid references public.todos (id) on delete set null,
  -- Habitasは論理削除(deleted_at)で同期する
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_user_id_idx on habitas.tasks (user_id);
create index tasks_linked_todo_id_idx on habitas.tasks (linked_todo_id) where linked_todo_id is not null;

create trigger set_tasks_updated_at
  before update on habitas.tasks
  for each row execute function public.set_current_timestamp_updated_at();

create table habitas.actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  kind text not null,
  is_active boolean not null default true,
  is_hidden boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index actions_user_id_idx on habitas.actions (user_id);

create trigger set_actions_updated_at
  before update on habitas.actions
  for each row execute function public.set_current_timestamp_updated_at();

create table habitas.task_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  task_id uuid not null references habitas.tasks (id) on delete cascade,
  status text not null check (status in ('todo', 'doing', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Habitasは upsert(onConflict: "user_id,day,task_id") で書き込む
  unique (user_id, day, task_id)
);

create index task_entries_task_id_day_idx on habitas.task_entries (task_id, day);
create index task_entries_user_id_day_idx on habitas.task_entries (user_id, day);

create trigger set_task_entries_updated_at
  before update on habitas.task_entries
  for each row execute function public.set_current_timestamp_updated_at();

create table habitas.action_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  action_id uuid not null references habitas.actions (id) on delete cascade,
  note text,
  volume integer,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index action_entries_action_id_day_idx on habitas.action_entries (action_id, day);

create trigger set_action_entries_updated_at
  before update on habitas.action_entries
  for each row execute function public.set_current_timestamp_updated_at();

create table habitas.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  note text,
  satisfaction integer,
  task_total integer not null default 0,
  action_total integer not null default 0,
  total_score integer not null default 0,
  task_ratio numeric not null default 0,
  action_ratio numeric not null default 0,
  balance_factor numeric not null default 0,
  -- 未記入の日は null(Habitasは未入力の充実度を null で保存する)
  fulfillment numeric,
  tomorrow_note text,
  yesterday_achievement text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

create trigger set_daily_logs_updated_at
  before update on habitas.daily_logs
  for each row execute function public.set_current_timestamp_updated_at();

create table habitas.notification_settings (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  habit_remind_on boolean not null default false,
  habit_remind_hour integer,
  habit_remind_minute integer,
  task_remind_on boolean not null default false,
  task_remind_hour integer,
  task_remind_minute integer,
  task_remind_timing text,
  review_remind_on boolean not null default false,
  review_remind_hour integer,
  review_remind_minute integer,
  volume_unit text,
  sort_rule text,
  prioritize_due boolean not null default false,
  updated_at timestamptz not null default now(),
  -- Habitasは upsert(onConflict: "user_id") で書き込む(1ユーザー1行)
  unique (user_id)
);

-- 元のHabitas設計を踏襲した、サブスクリプション/機能フラグ管理テーブル。
-- memory-calendarのpublic.profiles(表示名)とは別物 - 名前衝突を避けるため
-- habitasスキーマに置く。
create table habitas.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  no_ads boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 2b. APIロールへの権限(GRANT)
-- ============================================================
-- SQLで作ったスキーマは、PostgREST(anon/authenticated)から使うために
-- スキーマの USAGE とテーブルの権限を明示的に付ける必要がある
-- (Exposed schemas への追加とは別に必要)。実際の行アクセスはRLSで本人に限定する。
grant usage on schema habitas to authenticated, service_role;
grant select, insert, update, delete on all tables in schema habitas to authenticated;
grant all on all tables in schema habitas to service_role;
alter default privileges in schema habitas
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema habitas
  grant all on tables to service_role;
-- user_profiles(広告オフ等のフラグ)は、本人は読み取りのみ。書き込みはservice_roleのみ。
revoke insert, update, delete on habitas.user_profiles from authenticated;

-- ============================================================
-- 3. RLS(全テーブル、本人所有のみ)
-- ============================================================
alter table habitas.tasks enable row level security;
alter table habitas.actions enable row level security;
alter table habitas.task_entries enable row level security;
alter table habitas.action_entries enable row level security;
alter table habitas.daily_logs enable row level security;
alter table habitas.notification_settings enable row level security;
alter table habitas.user_profiles enable row level security;

create policy tasks_owner on habitas.tasks
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy actions_owner on habitas.actions
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy task_entries_owner on habitas.task_entries
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy action_entries_owner on habitas.action_entries
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy daily_logs_owner on habitas.daily_logs
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy notification_settings_owner on habitas.notification_settings
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 元のHabitas設計を踏襲し、書き込みはservice_roleのみ(本人は読み取りのみ)。
create policy user_profiles_select_own on habitas.user_profiles
  for select to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- 4. linked_todo_id は「自分がアクセスできるtodoにしか繋げない」ことを
--    DBレベルでも担保する(is_event_calendar_memberを再利用)。
-- ============================================================
create or replace function habitas.validate_linked_todo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.linked_todo_id is not null then
    if not exists (
      select 1
      from public.todos t
      where t.id = new.linked_todo_id
        and public.is_event_calendar_member(t.event_id, new.user_id)
    ) then
      raise exception 'linked_todo_id references a todo the user cannot access';
    end if;
  end if;
  return new;
end;
$$;

create trigger tasks_validate_linked_todo
  before insert or update of linked_todo_id on habitas.tasks
  for each row execute function habitas.validate_linked_todo();

-- ============================================================
-- 5. 進捗の双方向自動同期(DBトリガー)
-- ============================================================
-- 方針: リンクされたoneoffタスクについて、
--   todos.is_done が変わったら         → 対象日のtask_entries.statusへ反映
--   task_entries.status(対象日分)が変わったら → リンク先のtodos.is_doneへ反映
-- 「対象日」は tasks.due_date (無ければ当日) とする。
-- 双方向ループを避けるため、値が実際に変わる時だけ書き込む
-- (is distinct fromで比較し、既に同じ値なら何もしない)。

-- 5-1. todos.is_done → task_entries.status
create or replace function habitas.sync_task_entry_from_todo()
returns trigger
language plpgsql
security definer
set search_path = public, habitas
as $$
declare
  target_status text;
begin
  if new.is_done is distinct from old.is_done then
    target_status := case when new.is_done then 'done' else 'todo' end;

    update habitas.task_entries te
    set status = target_status, updated_at = now()
    from habitas.tasks t
    where te.task_id = t.id
      and t.linked_todo_id = new.id
      and te.day = coalesce(t.due_date, current_date)
      and te.status is distinct from target_status;

    -- 対象日のtask_entryがまだ無ければ作成する
    insert into habitas.task_entries (user_id, day, task_id, status)
    select t.user_id, coalesce(t.due_date, current_date), t.id, target_status
    from habitas.tasks t
    where t.linked_todo_id = new.id
      and not exists (
        select 1 from habitas.task_entries te
        where te.task_id = t.id and te.day = coalesce(t.due_date, current_date)
      );
  end if;
  return new;
end;
$$;

create trigger todos_sync_linked_task_entry
  after update of is_done on public.todos
  for each row execute function habitas.sync_task_entry_from_todo();

-- 5-2. task_entries.status → todos.is_done
create or replace function habitas.sync_todo_from_task_entry()
returns trigger
language plpgsql
security definer
set search_path = public, habitas
as $$
declare
  v_linked_todo_id uuid;
  v_due_date date;
  new_is_done boolean;
begin
  select t.linked_todo_id, t.due_date into v_linked_todo_id, v_due_date
  from habitas.tasks t where t.id = new.task_id;

  if v_linked_todo_id is null then
    return new;
  end if;
  -- 対象日(due_date、無ければ当日)以外のtask_entryは同期対象外
  if new.day is distinct from coalesce(v_due_date, current_date) then
    return new;
  end if;

  new_is_done := (new.status = 'done');

  update public.todos
  set is_done = new_is_done,
      completed_at = case when new_is_done then now() else null end
  where id = v_linked_todo_id
    and is_done is distinct from new_is_done;

  return new;
end;
$$;

create trigger task_entries_sync_linked_todo
  after insert or update of status on habitas.task_entries
  for each row execute function habitas.sync_todo_from_task_entry();
