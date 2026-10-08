-- 献立の通知(朝食/昼食/夕食/間食の時間に、その日の献立をプッシュ通知で知らせる)の設定。
-- 設定はユーザー単位(本人だけが読み書きできる)。時刻はJSTのtimeで持つ。
-- 配信は notification-dispatcher(毎分起動)が、設定時刻の10分以内のユーザーにだけ行う。

create table public.meal_notification_settings (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  -- 「予定に登録した献立の通知」のマスタースイッチ。オフなら下の項目は無視される。
  enabled boolean not null default false,
  breakfast_enabled boolean not null default true,
  breakfast_time time not null default '08:00',
  lunch_enabled boolean not null default true,
  lunch_time time not null default '12:00',
  dinner_enabled boolean not null default true,
  dinner_time time not null default '18:00',
  snack_enabled boolean not null default true,
  snack_time time not null default '15:00'
);

alter table public.meal_notification_settings enable row level security;

create policy meal_notification_settings_select_own
  on public.meal_notification_settings
  for select
  to authenticated
  using (user_id = auth.uid());

create policy meal_notification_settings_insert_own
  on public.meal_notification_settings
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy meal_notification_settings_update_own
  on public.meal_notification_settings
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- notification_log: 献立の通知は「ユーザー × 日付 × 食事の時間帯」で1通だけ送る。
-- 再実行(cronの重複・遅延)でも二重配信しないための冪等性キー。
alter table public.notification_log
  add column meal_date date,
  add column meal_slot text check (meal_slot in ('breakfast', 'lunch', 'dinner', 'snack'));

create unique index notification_log_meal_idempotency_key
  on public.notification_log (type, target_user_id, meal_date, meal_slot)
  where meal_slot is not null;
