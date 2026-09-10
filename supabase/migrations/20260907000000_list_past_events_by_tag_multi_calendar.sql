-- ToDo/振り返り/思い出タブもカレンダー画面と同じ「複数カレンダーを選択(タップで表示/非表示)」
-- UIに揃えるため、list_past_events_by_tagの単一カレンダー指定(p_calendar_id)を
-- 複数カレンダー指定(p_calendar_ids配列)に変更する。null/空配列は「絞り込みなし」を意味する。

drop function if exists public.list_past_events_by_tag(uuid, uuid);

create or replace function public.list_past_events_by_tag(p_calendar_ids uuid[] default null, p_tag_id uuid default null)
returns setof public.events
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_calendar_ids is not null and exists (
    select 1 from unnest(p_calendar_ids) as cid
    where not public.is_calendar_member(cid, auth.uid())
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_tag_id is not null and not exists (
    select 1 from public.tags where id = p_tag_id and user_id = auth.uid()
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_tag_id is null then
    return query
      select e.*
      from public.events e
      join public.calendar_members cm on cm.calendar_id = e.calendar_id and cm.user_id = auth.uid()
      where e.end_at < now()
        and (p_calendar_ids is null or e.calendar_id = any(p_calendar_ids))
      order by e.start_at desc;
  else
    return query
      with recursive descendant_tags as (
        select id from public.tags where id = p_tag_id
        union all
        select t.id
        from public.tags t
        join descendant_tags dt on t.parent_id = dt.id
      )
      select distinct e.*
      from public.events e
      join public.calendar_members cm on cm.calendar_id = e.calendar_id and cm.user_id = auth.uid()
      join public.event_tags et on et.event_id = e.id
      where e.end_at < now()
        and (p_calendar_ids is null or e.calendar_id = any(p_calendar_ids))
        and et.tag_id in (select id from descendant_tags)
      order by e.start_at desc;
  end if;
end;
$$;

revoke all on function public.list_past_events_by_tag(uuid[], uuid) from public;
grant execute on function public.list_past_events_by_tag(uuid[], uuid) to authenticated;
