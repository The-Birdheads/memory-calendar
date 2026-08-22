-- タスク7.1: タグ絞り込み(階層を問わない、祖先→子孫の再帰CTE)による過去予定の一覧取得

create or replace function public.list_past_events_by_tag(p_calendar_id uuid, p_tag_id uuid default null)
returns setof public.events
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_calendar_member(p_calendar_id, auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_tag_id is null then
    return query
      select e.*
      from public.events e
      where e.calendar_id = p_calendar_id
        and e.end_at < now()
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
      join public.event_tags et on et.event_id = e.id
      where e.calendar_id = p_calendar_id
        and e.end_at < now()
        and et.tag_id in (select id from descendant_tags)
      order by e.start_at desc;
  end if;
end;
$$;

revoke all on function public.list_past_events_by_tag(uuid, uuid) from public;
grant execute on function public.list_past_events_by_tag(uuid, uuid) to authenticated;
