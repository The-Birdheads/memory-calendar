-- event_remindersの「カスタム」仕様変更: 絶対時刻(custom_at)ではなく、
-- 「N 分/時間/日/週間 前」という相対オフセット(custom_value + custom_unit)に変更する。
-- これにより1件のイベントに複数のカスタムリマインドを追加できるようになる
-- (「同じユーザーで1件まで」の制限を撤廃し、全く同じ(値,単位)の重複だけを防ぐ)。
--
-- 20260906010000で作成したevent_remindersは既に本番に反映済みのため、この
-- マイグレーションでは(過去のマイグレーションファイル自体を書き換えるのではなく)
-- 差分としてalter/drop/再作成を行う。

-- 万一、絶対時刻(custom_at)しか持たないカスタム行が残っていた場合、
-- 相対オフセットへ意味変換できないため削除する
-- (この機能はまだどのクライアントからも書き込まれていないはずで、通常は0件)。
delete from public.event_reminders where kind = 'custom';

alter table public.event_reminders
  add column custom_value integer check (custom_value is null or custom_value > 0);
alter table public.event_reminders
  add column custom_unit text check (custom_unit in ('minute', 'hour', 'day', 'week'));

alter table public.event_reminders drop constraint if exists event_reminders_custom_at_matches_kind;
alter table public.event_reminders add constraint event_reminders_custom_value_matches_kind check (
  (kind = 'custom' and custom_value is not null and custom_unit is not null)
  or (kind <> 'custom' and custom_value is null and custom_unit is null)
);

drop index if exists event_reminders_unique_custom;
create unique index event_reminders_unique_custom
  on public.event_reminders (event_id, user_id, custom_value, custom_unit)
  where kind = 'custom';

alter table public.event_reminders drop column custom_at;

-- compute_event_reminder_at: 新シグネチャ(custom_value, custom_unitを受け取る)で再作成し、
-- 旧シグネチャの関数は明示的に削除する(引数の数が変わるため create or replace では
-- 置き換わらず、別のオーバーロードとして残ってしまうため)。
drop function if exists public.compute_event_reminder_at(text, timestamptz, timestamptz);

create or replace function public.compute_event_reminder_at(
  p_kind text,
  p_custom_value integer,
  p_custom_unit text,
  p_start_at timestamptz
) returns timestamptz
language sql
stable
as $$
  select case p_kind
    when 'custom' then p_start_at - (p_custom_value || ' ' || p_custom_unit)::interval
    when 'on_day' then ((p_start_at at time zone 'Asia/Tokyo')::date::text || ' 09:00:00')::timestamp at time zone 'Asia/Tokyo'
    when 'day_before_1' then (((p_start_at at time zone 'Asia/Tokyo')::date - 1)::text || ' 09:00:00')::timestamp at time zone 'Asia/Tokyo'
    when 'day_before_2' then (((p_start_at at time zone 'Asia/Tokyo')::date - 2)::text || ' 09:00:00')::timestamp at time zone 'Asia/Tokyo'
    when 'at_start' then p_start_at
    when 'before_10m' then p_start_at - interval '10 minutes'
    when 'before_1h' then p_start_at - interval '1 hour'
    else null
  end;
$$;

revoke all on function public.compute_event_reminder_at(text, integer, text, timestamptz) from public;
grant execute on function public.compute_event_reminder_at(text, integer, text, timestamptz) to anon, authenticated;

-- remind_atの自動計算トリガー: 新シグネチャの関数を呼ぶよう更新(トリガー自体の定義は
-- 20260906010000のものをそのまま使い続けられるので、対象の関数本体だけを差し替える)。
create or replace function public.set_event_reminder_remind_at()
returns trigger
language plpgsql
as $$
declare
  v_start_at timestamptz;
begin
  select start_at into v_start_at from public.events where id = new.event_id;
  new.remind_at := public.compute_event_reminder_at(new.kind, new.custom_value, new.custom_unit, v_start_at);
  return new;
end;
$$;

-- 予定のstart_at変更時の再計算: カスタムも相対オフセットになったため、
-- カスタムを除外していた条件(and kind <> 'custom')を外し、全リマインドを対象にする。
create or replace function public.recompute_event_reminders_on_event_start_change()
returns trigger
language plpgsql
as $$
begin
  if new.start_at is distinct from old.start_at then
    update public.event_reminders
    set remind_at = public.compute_event_reminder_at(kind, custom_value, custom_unit, new.start_at)
    where event_id = new.id;
  end if;
  return new;
end;
$$;
