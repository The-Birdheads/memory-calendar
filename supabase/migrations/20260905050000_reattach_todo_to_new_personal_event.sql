-- タスク16.5: 未紐付けToDoの復活(個人用カレンダーでの新規予定作成と同時の再紐付け)

create or replace function public.reattach_todo_to_new_personal_event(
  p_todo_id uuid,
  p_title text,
  p_date date
)
returns public.todos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_todo public.todos;
  v_calendar_id uuid;
  v_event_id uuid;
begin
  select * into v_todo from public.todos where id = p_todo_id;

  if not found then
    raise exception 'todo_not_found' using errcode = 'A0001';
  end if;

  if v_todo.created_by <> auth.uid() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select id into v_calendar_id
  from public.calendars
  where created_by = auth.uid() and kind = 'personal';

  if not found then
    raise exception 'personal_calendar_not_found' using errcode = 'A0005';
  end if;

  insert into public.events (calendar_id, title, start_at, end_at, is_all_day, created_by, updated_by)
  values (v_calendar_id, p_title, p_date::timestamptz, p_date::timestamptz, true, auth.uid(), auth.uid())
  returning id into v_event_id;

  update public.todos set event_id = v_event_id where id = p_todo_id
  returning * into v_todo;

  return v_todo;
end;
$$;

revoke all on function public.reattach_todo_to_new_personal_event(uuid, text, date) from public;
grant execute on function public.reattach_todo_to_new_personal_event(uuid, text, date) to authenticated;
