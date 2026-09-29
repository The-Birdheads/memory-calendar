-- カレンダー名も、色と同様にオーナーだけでなくメンバー誰でも変更できるようにする。
-- calendars テーブル自体のUPDATE(種別=kind含む)は既存の calendars_update_owner
-- ポリシー(オーナーのみ)のままにしたいので、RLSを緩めるのではなく、名前だけを
-- メンバー権限で更新するSECURITY DEFINER RPCを別途用意する(update_calendar_color
-- と同じパターン)。

create or replace function public.update_calendar_name(p_calendar_id uuid, p_name text)
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

  if trim(p_name) = '' then
    raise exception 'validation_error' using errcode = '23514';
  end if;

  update public.calendars
  set name = trim(p_name)
  where id = p_calendar_id
  returning * into v_calendar;

  if not found then
    raise exception 'calendar_not_found' using errcode = 'A0001';
  end if;

  return v_calendar;
end;
$$;

revoke all on function public.update_calendar_name(uuid, text) from public;
grant execute on function public.update_calendar_name(uuid, text) to authenticated;
