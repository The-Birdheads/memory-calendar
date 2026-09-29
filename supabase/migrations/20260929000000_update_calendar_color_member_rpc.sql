-- グループカレンダーの色は、作成者だけでなくメンバー誰でも変更できるようにする。
-- calendars テーブル自体のUPDATE(名前・種別含む)は既存の calendars_update_owner
-- ポリシー(オーナーのみ)のままにしたいので、RLSを緩めるのではなく、色だけを
-- メンバー権限で更新するSECURITY DEFINER RPCを別途用意する。

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

  update public.calendars
  set color = p_color
  where id = p_calendar_id
  returning * into v_calendar;

  if not found then
    raise exception 'calendar_not_found' using errcode = 'A0001';
  end if;

  return v_calendar;
end;
$$;

revoke all on function public.update_calendar_color(uuid, text) from public;
grant execute on function public.update_calendar_color(uuid, text) to authenticated;
