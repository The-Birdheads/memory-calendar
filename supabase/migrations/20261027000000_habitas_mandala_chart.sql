-- Habitas 1.4.0: マンダラチャート(目標)と、習慣の頻度。
-- 企画: life-os/docs/mandala-chart.md
--
-- - 習慣の頻度(毎日 / 週n回 / 曜日指定)と、変える前の頻度の履歴
-- - 習慣・タスクと、チャートのマス(行動目標)とのひもづけ(ひもづけた日から進み具合を数える)
-- - チャート、マス、マスの変更の履歴、見直しの記録
-- 進み具合は保存せず、task_entries から計算する(見直しの記録の snapshot にだけ残す)。

-- ============================================================
-- 1. チャートとマス
-- ============================================================

create table habitas.mandala_charts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- 大目標(チャートの中心のマス)
  title text not null default '',
  start_date date,
  -- 期限(任意)
  end_date date,
  status text not null default 'active' check (status in ('active', 'finished')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mandala_charts_user_id_idx on habitas.mandala_charts (user_id);

-- 要素(cell_index is null)と行動目標(cell_index 0〜7)のマス。
-- 文言を書いたときに作る(空のマスは行を持たない)。マスを空にしても行は残す(変更の履歴を残すため)。
create table habitas.mandala_cells (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  chart_id uuid not null references habitas.mandala_charts (id) on delete cascade,
  element_index smallint not null check (element_index between 0 and 7),
  cell_index smallint check (cell_index between 0 and 7),
  text text not null default '',
  -- 要素の色(要素のマスだけが持つ)
  color text,
  status text not null default 'active' check (status in ('active', 'paused', 'achieved')),
  -- 休止した期間 [{"from": "YYYY-MM-DD", "to": "YYYY-MM-DD" | null}]。この期間は進み具合に数えない
  paused_periods jsonb not null default '[]'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (chart_id, element_index, cell_index)
);

create index mandala_cells_user_id_idx on habitas.mandala_cells (user_id);

-- マスの変更の履歴。追記のみ(作った・ひもづけた・外した・見直しで変えた など)
create table habitas.mandala_cell_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cell_id uuid not null references habitas.mandala_cells (id) on delete cascade,
  kind text not null check (kind in (
    'created', 'edited', 'linked', 'unlinked', 'lowered', 'changed',
    'paused', 'resumed', 'achieved', 'removed'
  )),
  note text not null default '',
  -- 関係する習慣・タスク(消えても履歴は残す)
  task_id uuid references habitas.tasks (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mandala_cell_events_user_id_idx on habitas.mandala_cell_events (user_id);
create index mandala_cell_events_cell_id_idx on habitas.mandala_cell_events (cell_id);

-- 見直しの記録。保存後は変更しない(snapshot は見直す前のチャートと、当時の進み具合)
create table habitas.mandala_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  chart_id uuid not null references habitas.mandala_charts (id) on delete cascade,
  reviewed_at timestamptz not null default now(),
  good_note text,
  next_note text,
  decisions jsonb not null default '[]'::jsonb,
  snapshot jsonb not null default '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mandala_reviews_user_id_idx on habitas.mandala_reviews (user_id);
create index mandala_reviews_chart_id_idx on habitas.mandala_reviews (chart_id);

-- ============================================================
-- 2. 習慣・タスクの列
-- ============================================================

alter table habitas.tasks
  add column frequency_kind text not null default 'daily'
    check (frequency_kind in ('daily', 'weekly_count', 'weekdays')),
  -- 週n回の n
  add column frequency_count smallint check (frequency_count between 1 and 6),
  -- 曜日指定(ビット: 月=1, 火=2, 水=4, 木=8, 金=16, 土=32, 日=64)
  add column frequency_days smallint check (frequency_days between 1 and 127),
  -- 変える前の頻度 [{"from","to","kind","count","days"}]。その期間は前の頻度で数える
  add column frequency_history jsonb not null default '[]'::jsonb,
  add column mandala_cell_id uuid references habitas.mandala_cells (id) on delete set null,
  -- ひもづけた日。この日より前の記録は、マスの進み具合に数えない
  add column mandala_linked_at date,
  -- 見直しなどで終了した日(記録は残す)
  add column ended_at date,
  add constraint tasks_frequency_shape check (
    (frequency_kind = 'daily')
    or (frequency_kind = 'weekly_count' and frequency_count is not null)
    or (frequency_kind = 'weekdays' and frequency_days is not null)
  );

create index tasks_mandala_cell_id_idx on habitas.tasks (mandala_cell_id) where mandala_cell_id is not null;

-- ============================================================
-- 3. 権限と RLS
-- ============================================================
-- habitas スキーマの既定の権限(20260921000000)で authenticated / service_role に付与される

alter table habitas.mandala_charts enable row level security;
alter table habitas.mandala_cells enable row level security;
alter table habitas.mandala_cell_events enable row level security;
alter table habitas.mandala_reviews enable row level security;

create policy mandala_charts_owner on habitas.mandala_charts
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 自分のチャートのマスだけ
create policy mandala_cells_owner on habitas.mandala_cells
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from habitas.mandala_charts c where c.id = chart_id and c.user_id = auth.uid())
  );

create policy mandala_cell_events_owner on habitas.mandala_cell_events
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from habitas.mandala_cells c where c.id = cell_id and c.user_id = auth.uid())
  );

create policy mandala_reviews_owner on habitas.mandala_reviews
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from habitas.mandala_charts c where c.id = chart_id and c.user_id = auth.uid())
  );

-- 習慣・タスクは、自分のマスにだけひもづけられる
create or replace function habitas.validate_task_mandala_cell()
returns trigger
language plpgsql
security definer
set search_path = habitas, public
as $$
begin
  if new.mandala_cell_id is not null and not exists (
    select 1 from habitas.mandala_cells c where c.id = new.mandala_cell_id and c.user_id = new.user_id
  ) then
    raise exception 'mandala_cell_id references a cell of another user';
  end if;
  return new;
end;
$$;

create trigger tasks_validate_mandala_cell
  before insert or update of mandala_cell_id on habitas.tasks
  for each row execute function habitas.validate_task_mandala_cell();

-- ============================================================
-- 4. アプリ別のアカウント削除・利用判定に追加
-- ============================================================

create or replace function public._delete_habitas_data(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public, habitas
as $$
begin
  -- task_entries / action_entries / マス・履歴・見直しは親からの on delete cascade でも消えるが、
  -- 明示して順序に依存しないようにする
  delete from habitas.mandala_reviews where user_id = p_uid;
  delete from habitas.mandala_cell_events where user_id = p_uid;
  delete from habitas.task_entries where user_id = p_uid;
  delete from habitas.action_entries where user_id = p_uid;
  delete from habitas.tasks where user_id = p_uid;
  delete from habitas.mandala_cells where user_id = p_uid;
  delete from habitas.mandala_charts where user_id = p_uid;
  delete from habitas.actions where user_id = p_uid;
  delete from habitas.daily_logs where user_id = p_uid;
  delete from habitas.notification_settings where user_id = p_uid;
  delete from habitas.user_profiles where user_id = p_uid;
end;
$$;

revoke all on function public._delete_habitas_data(uuid) from public;

-- Habitas の利用判定に、チャートの有無を加える(習慣・タスクをまだ作っていない利用者のため)
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
        or exists (select 1 from public.push_tokens where user_id = p_uid)
        or exists (select 1 from public.todos where created_by = p_uid)
        or exists (select 1 from public.tags where user_id = p_uid)
      )
    )
    or (
      p_app = 'habitas'
      and (
        exists (select 1 from habitas.tasks where user_id = p_uid)
        or exists (select 1 from habitas.mandala_charts where user_id = p_uid)
      )
    );
$$;

revoke all on function public._app_in_use(uuid, text) from public;
