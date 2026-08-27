-- 不具合修正: メンバー一覧に生のUUIDが表示され続ける問題
--
-- handle_new_user() が profiles.display_name を一切設定していなかったため、
-- カレンダーの他メンバー一覧が常に表示名を持たず、画面にユーザーIDがそのまま
-- 表示されてしまっていた。
--
-- サインアップ時のメタデータ(Googleログインの full_name / name、
-- メール登録時に渡す display_name)から表示名を設定するようにする。
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 既存ユーザーの表示名を、認証プロバイダのメタデータから一度だけ補完する
update public.profiles p
set display_name = coalesce(
  u.raw_user_meta_data ->> 'display_name',
  u.raw_user_meta_data ->> 'full_name',
  u.raw_user_meta_data ->> 'name'
)
from auth.users u
where u.id = p.id
  and p.display_name is null
  and coalesce(
    u.raw_user_meta_data ->> 'display_name',
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name'
  ) is not null;
