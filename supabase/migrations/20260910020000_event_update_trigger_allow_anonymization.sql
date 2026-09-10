-- アカウント削除時、共有カレンダーに残る予定の created_by / updated_by は
-- ON DELETE SET NULL で NULL 化される(20260910000000)。しかし events の
-- BEFORE UPDATE トリガー handle_event_update が
--   new.created_by = old.created_by;   -- 変更を常に巻き戻す
--   new.updated_by = auth.uid();       -- 常に打刻し直す
-- としているため、SET NULL の連鎖UPDATE でも created_by が元の値に戻され、
-- updated_by には(退会処理中はまだ設定されている)本人のidが書き込まれ、
-- 直後に削除される profiles 行を参照して外部キー違反になる。
--
-- 対処: created_by は「NULL 以外への変更」だけを巻き戻す(SET NULL は通す)。
-- updated_by は auth.uid() が取得できるとき(＝実ユーザーの操作)だけ打刻する
-- (システム操作・退会時の匿名化連鎖では触らない)。
create or replace function public.handle_event_update()
returns trigger
language plpgsql
as $$
begin
  -- 利用者は created_by を変更できない。ただし退会処理の ON DELETE SET NULL による
  -- NULL 化は許可する。
  if new.created_by is not null then
    new.created_by = old.created_by;
  end if;

  -- 実ユーザーの更新なら更新者で打刻し直す。auth.uid() が無い場合
  -- (退会時の匿名化連鎖など)は updated_by に触れず、SET NULL 連鎖を妨げない。
  if auth.uid() is not null then
    new.updated_by = auth.uid();
  end if;

  return new;
end;
$$;
