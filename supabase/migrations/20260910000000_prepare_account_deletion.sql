-- アカウント削除機能の準備: auth.users の削除(RPC delete_own_account、次のマイグレーションで定義)が
-- 外部キー制約で失敗しないよう、profiles(id) を参照している列のon delete動作を整理する。
--
-- 方針は2つに分かれる:
-- 1) 本人にのみ閲覧・操作が許可されている完全プライベートなデータ(ToDo/タグ/スタンプ)は、
--    アカウントと一緒に削除してよい -> on delete cascade
-- 2) 共有カレンダー内の「思い出」コンテンツ(予定・コメント・写真・献立記録など)は、
--    投稿者が退会した後もカレンダーの他メンバーのために残す -> on delete set null
--    (作成者/更新者列をNULL許容にした上で、削除時にNULLへ差し替える)

-- --- 1) 完全プライベート: on delete cascade ---

alter table public.todos
  drop constraint todos_created_by_fkey,
  add constraint todos_created_by_fkey
    foreign key (created_by) references public.profiles (id) on delete cascade;

alter table public.tags
  drop constraint tags_user_id_fkey,
  add constraint tags_user_id_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.event_reactions
  drop constraint event_reactions_user_id_fkey,
  add constraint event_reactions_user_id_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade;

-- --- 2) 共有カレンダーのコンテンツ: NULL許容化 + on delete set null ---

alter table public.calendars
  alter column created_by drop not null,
  drop constraint calendars_created_by_fkey,
  add constraint calendars_created_by_fkey
    foreign key (created_by) references public.profiles (id) on delete set null;

alter table public.calendar_invites
  alter column created_by drop not null,
  drop constraint calendar_invites_created_by_fkey,
  add constraint calendar_invites_created_by_fkey
    foreign key (created_by) references public.profiles (id) on delete set null;

alter table public.events
  alter column created_by drop not null,
  alter column updated_by drop not null,
  drop constraint events_created_by_fkey,
  drop constraint events_updated_by_fkey,
  add constraint events_created_by_fkey
    foreign key (created_by) references public.profiles (id) on delete set null,
  add constraint events_updated_by_fkey
    foreign key (updated_by) references public.profiles (id) on delete set null;

alter table public.event_series_creation_events
  alter column created_by drop not null,
  drop constraint event_series_creation_events_created_by_fkey,
  add constraint event_series_creation_events_created_by_fkey
    foreign key (created_by) references public.profiles (id) on delete set null;

alter table public.event_comments
  alter column user_id drop not null,
  drop constraint event_comments_user_id_fkey,
  add constraint event_comments_user_id_fkey
    foreign key (user_id) references public.profiles (id) on delete set null;

alter table public.event_photos
  alter column uploaded_by drop not null,
  drop constraint event_photos_uploaded_by_fkey,
  add constraint event_photos_uploaded_by_fkey
    foreign key (uploaded_by) references public.profiles (id) on delete set null;

alter table public.meal_records
  alter column created_by drop not null,
  drop constraint meal_records_created_by_fkey,
  add constraint meal_records_created_by_fkey
    foreign key (created_by) references public.profiles (id) on delete set null;
