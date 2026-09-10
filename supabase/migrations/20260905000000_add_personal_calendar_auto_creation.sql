-- タスク14.1: サインアップトリガー拡張と個人用カレンダーの一意性保証

-- 1ユーザーにつきkind='personal'のカレンダーは常に1件のみ、をDBレベルで保証する
create unique index calendars_created_by_personal_unique_idx
  on public.calendars (created_by)
  where kind = 'personal';

-- calendars: クライアントからの直接INSERTはkind='group'の場合のみ許可する。
-- kind='personal'はSECURITY DEFINERのサインアップトリガー(handle_new_user)経由でのみ作成できる。
drop policy calendars_insert_own on public.calendars;
create policy calendars_insert_own
  on public.calendars
  for insert
  to authenticated
  with check (created_by = auth.uid() and kind = 'group');

-- calendar_invites: 個人用カレンダーには他のユーザーを招待できないようにする(要件2.9)
drop policy calendar_invites_insert_owner_or_editor on public.calendar_invites;
create policy calendar_invites_insert_owner_or_editor
  on public.calendar_invites
  for insert
  to authenticated
  with check (
    public.is_calendar_owner_or_editor(calendar_id, auth.uid())
    and created_by = auth.uid()
    and exists (
      select 1 from public.calendars c
      where c.id = calendar_id and c.kind = 'group'
    )
  );

-- auth.users 作成時に、profiles行の作成と同一トランザクションで個人用カレンダーを1件作成する。
-- calendars へのINSERTは既存の on_calendar_created トリガーを再利用し、calendar_members への
-- オーナー登録を自動的に連鎖させる(このトリガーはSECURITY DEFINER関数のためRLSの対象外)。
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

  insert into public.calendars (name, kind, created_by)
  values ('Myカレンダー', 'personal', new.id);

  return new;
end;
$$;
