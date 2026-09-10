-- アカウント削除(RPC delete_own_account)
-- App Storeガイドライン5.1.1(v)対応: アカウント作成機能を持つアプリはアプリ内での
-- アカウント削除手段を提供する必要があるため追加する。
--
-- 呼び出し元(自分自身)のデータを次の順で片付けてから auth.users を削除する。
-- 1. 個人用カレンダー(本人専用の領域)は丸ごと削除する
--    -> 配下の予定・写真・コメント・タグ紐付け・リマインド等は on delete cascade で連鎖削除される
-- 2. 参加中の共有カレンダーは、既存の leave_or_delete_calendar と同じ規則
--    (自分だけのメンバーなら削除、他にメンバーがいれば自分だけ抜ける)で後始末する
-- 3. auth.users を削除する -> public.profiles は on delete cascade で連鎖削除され、
--    そこからToDo/タグ/スタンプ/リマインド設定/Pushトークン等の完全プライベートなデータも
--    連鎖削除される。共有カレンダーに残る予定・コメント・写真・献立記録の作成者/更新者列は
--    (前段のマイグレーションで on delete set null 化済みのため)NULLになり、コンテンツ自体は
--    他のメンバーのために残る。
--
-- 注意: auth.users を直接DELETEするため、Supabase Admin APIのdeleteUserとは異なり
-- 既存のリフレッシュトークン/アクセストークンの即時失効までは保証しない
-- (アクセストークンは有効期限が切れるまで署名検証自体は通り得る)。呼び出し元アプリは
-- このRPC成功後、必ずクライアント側でも明示的にsignOutしてローカルセッションを破棄すること。
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_calendar_id uuid;
  v_personal_calendar_id uuid;
begin
  select id into v_personal_calendar_id
  from public.calendars
  where created_by = auth.uid() and kind = 'personal';

  if v_personal_calendar_id is not null then
    delete from public.calendars where id = v_personal_calendar_id;
  end if;

  for v_calendar_id in
    select calendar_id from public.calendar_members where user_id = auth.uid()
  loop
    perform public.leave_or_delete_calendar(v_calendar_id);
  end loop;

  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
