-- delete_own_account の修正(20260910010000 を置き換え)。
-- auth.uid() を最初に控え、以降はその控えを使う。auth.users を削除する直前に
-- JWT クレームを外し、連鎖する events の BEFORE UPDATE トリガーが
-- updated_by = auth.uid() を書き戻さないようにする(20260910020000 の
-- handle_event_update は auth.uid() が null なら打刻をスキップする)。
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_calendar_id uuid;
  v_personal_calendar_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- 1. 個人用カレンダー(本人専用領域)はまるごと削除する
  --    (配下の予定・写真・コメント・タグ紐付け・リマインドは on delete cascade)
  select id into v_personal_calendar_id
  from public.calendars
  where created_by = v_uid and kind = 'personal';

  if v_personal_calendar_id is not null then
    delete from public.calendars where id = v_personal_calendar_id;
  end if;

  -- 2. 参加中の共有カレンダーは leave_or_delete_calendar と同じ規則で後始末する
  --    (この関数は内部で auth.uid() を使うため、ここではまだクレームを外さない)
  for v_calendar_id in
    select calendar_id from public.calendar_members where user_id = v_uid
  loop
    perform public.leave_or_delete_calendar(v_calendar_id);
  end loop;

  -- 3. 認証情報を削除する。events の created_by/updated_by は on delete set null で
  --    NULL 化されるが、その連鎖UPDATE で BEFORE トリガーが updated_by を打刻し直す
  --    のを防ぐため、先に JWT クレームを外して auth.uid() を null にする。
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);

  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
