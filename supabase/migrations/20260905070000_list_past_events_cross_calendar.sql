-- タスク18.1: タグ絞り込みを、単一カレンダー指定必須から自分のタグを軸にした
-- カレンダー横断のクエリへ変更する(要件11.1, 11.2, 11.6)

create or replace function public.list_past_events_by_tag(p_calendar_id uuid default null, p_tag_id uuid default null)
returns setof public.events
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_calendar_id is not null and not public.is_calendar_member(p_calendar_id, auth.uid()) then
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
        and (p_calendar_id is null or e.calendar_id = p_calendar_id)
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
        and (p_calendar_id is null or e.calendar_id = p_calendar_id)
        and et.tag_id in (select id from descendant_tags)
      order by e.start_at desc;
  end if;
end;
$$;
