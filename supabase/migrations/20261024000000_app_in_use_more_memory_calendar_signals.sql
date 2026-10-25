-- _app_in_use(20260922000000)の改善: Memory Calendar を使っているとみなす実データの条件を増やす。
--
-- 背景: ログイン直後(予定をまだ作っていない)の Memory Calendar 利用者は、
--   - アプリが register_app_use を呼ぶ版(これから配布)を使っていなければ app_usage に記録が無く、
--   - 予定も共有カレンダーも無い
-- ため「使っていない」と判定され、Habitas のアカウント削除でアカウントごと消えてしまっていた
-- (実機確認で発生)。Memory Calendar はログイン後に必ず Push トークンを登録する(通知を許可している場合)ので、
-- Push トークン・ToDo・タグも「使用中」の根拠に加える。
--
-- 根本対策は、Memory Calendar の新バージョン(register_app_use を呼ぶ版)を、
-- Habitas の新バージョンより前、または同時にリリースすること。
create or replace function public._app_in_use(p_uid uuid, p_app text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (select 1 from public.app_usage where user_id = p_uid and app = p_app)
    or (
      p_app = 'memory_calendar'
      and (
        exists (select 1 from public.events where created_by = p_uid)
        or exists (
          select 1
          from public.calendar_members m
          join public.calendars c on c.id = m.calendar_id
          where m.user_id = p_uid and c.kind = 'group'
        )
        or exists (select 1 from public.push_tokens where user_id = p_uid)
        or exists (select 1 from public.todos where created_by = p_uid)
        or exists (select 1 from public.tags where user_id = p_uid)
      )
    )
    or (
      p_app = 'habitas'
      and exists (select 1 from habitas.tasks where user_id = p_uid)
    );
$$;

revoke all on function public._app_in_use(uuid, text) from public;
