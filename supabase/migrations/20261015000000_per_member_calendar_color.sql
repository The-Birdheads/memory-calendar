-- カレンダーの色をメンバーごとに持てるようにする。
-- calendars.color は「作成した時点の色」として残し、各メンバーのデフォルトにする。
-- メンバーが色を変更すると calendar_member_colors に本人の行だけが保存され、
-- 他のメンバーの表示色は変わらない(変更した本人にだけ反映される)。
-- 行が無いメンバーは、これまで通り calendars.color を使う。

create table public.calendar_member_colors (
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  color text not null,
  primary key (calendar_id, user_id)
);

alter table public.calendar_member_colors enable row level security;

-- 本人の行だけ読める(クライアントは user_id で絞り込まなくても自分の色だけ取得できる)。
-- 書き込みは下の SECURITY DEFINER RPC 経由のみ。
create policy calendar_member_colors_select_own
  on public.calendar_member_colors
  for select
  to authenticated
  using (user_id = auth.uid());

-- 呼び出したメンバー本人の表示色を保存する。戻り値のカレンダーは、色が
-- 保存した色になっている(calendars テーブル自体は更新しない)。
create or replace function public.update_calendar_color(p_calendar_id uuid, p_color text)
returns public.calendars
language plpgsql
security definer
set search_path = public
as $$
declare
  v_calendar public.calendars;
begin
  if not public.is_calendar_member(p_calendar_id, auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_calendar from public.calendars where id = p_calendar_id;

  if not found then
    raise exception 'calendar_not_found' using errcode = 'A0001';
  end if;

  insert into public.calendar_member_colors (calendar_id, user_id, color)
  values (p_calendar_id, auth.uid(), p_color)
  on conflict (calendar_id, user_id) do update set color = excluded.color;

  v_calendar.color := p_color;
  return v_calendar;
end;
$$;

revoke all on function public.update_calendar_color(uuid, text) from public;
grant execute on function public.update_calendar_color(uuid, text) to authenticated;
