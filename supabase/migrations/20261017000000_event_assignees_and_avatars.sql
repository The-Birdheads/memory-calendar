-- 共有カレンダーの予定に「対象者」を設定できるようにし、ユーザーのアイコン画像を登録できるようにする。
--
-- 1) profiles.avatar_path: アイコン画像の保存先(avatars バケット内のパス)。NULL なら
--    アプリ側で表示名の頭文字をアイコンにする。
-- 2) avatars バケット: 非公開。自分のフォルダ({user_id}/...)にだけ書き込め、自分と、
--    同じカレンダーに所属するメンバーだけが読める(署名付きURLで表示する)。
-- 3) event_assignees: 予定ごとの対象者(任意・複数可)。対象者は、その予定のカレンダーの
--    メンバーに限る。共有(group)カレンダーの予定だけが対象。

-- 1) アイコン画像のパス
alter table public.profiles add column avatar_path text;

-- 2) avatars バケット
-- 自分と同じカレンダーに所属しているユーザーか(引数はユーザーIDの文字列。ストレージの
-- フォルダ名と比較するため、uuid へのキャストで失敗しないよう text で受ける)。
create or replace function public.shares_calendar_with(p_user_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.calendar_members mine
    join public.calendar_members theirs on theirs.calendar_id = mine.calendar_id
    where mine.user_id = auth.uid()
      and theirs.user_id::text = p_user_id
  );
$$;

revoke all on function public.shares_calendar_with(text) from public;
grant execute on function public.shares_calendar_with(text) to authenticated;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

create policy avatars_storage_select_self_or_member
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.shares_calendar_with((storage.foldername(name))[1])
    )
  );

create policy avatars_storage_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_storage_delete_own
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3) 予定の対象者
create table public.event_assignees (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index event_assignees_user_id_idx on public.event_assignees (user_id);

alter table public.event_assignees enable row level security;

-- カレンダーのメンバーなら、その予定の対象者を見られる・設定できる(予定そのものの編集権限と同じ)。
create policy event_assignees_select_member
  on public.event_assignees
  for select
  to authenticated
  using (public.is_event_calendar_member(event_id, auth.uid()));

create policy event_assignees_insert_member
  on public.event_assignees
  for insert
  to authenticated
  with check (public.is_event_calendar_member(event_id, auth.uid()));

create policy event_assignees_delete_member
  on public.event_assignees
  for delete
  to authenticated
  using (public.is_event_calendar_member(event_id, auth.uid()));

-- 対象者にできるのは、共有(group)カレンダーの予定の、そのカレンダーのメンバーだけ。
create or replace function public.validate_event_assignee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_calendar_id uuid;
  v_kind text;
begin
  select e.calendar_id, c.kind
    into v_calendar_id, v_kind
  from public.events e
  join public.calendars c on c.id = e.calendar_id
  where e.id = new.event_id;

  if v_kind is distinct from 'group' then
    raise exception 'assignee_only_on_group_calendar' using errcode = '23514';
  end if;

  if not public.is_calendar_member(v_calendar_id, new.user_id) then
    raise exception 'assignee_not_calendar_member' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger event_assignees_validate
  before insert on public.event_assignees
  for each row execute function public.validate_event_assignee();

-- カレンダーから抜けた(外された)メンバーは、そのカレンダーの予定の対象者からも外す。
create or replace function public.remove_assignee_on_member_removed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.event_assignees ea
  using public.events e
  where ea.event_id = e.id
    and e.calendar_id = old.calendar_id
    and ea.user_id = old.user_id;
  return old;
end;
$$;

create trigger calendar_members_remove_assignee
  after delete on public.calendar_members
  for each row execute function public.remove_assignee_on_member_removed();

-- 予定を別のカレンダーへ移したら、移動先のメンバーではない人(移動先が個人用カレンダーなら全員)を
-- 対象者から外す。
create or replace function public.prune_assignees_on_event_calendar_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.calendar_id is distinct from old.calendar_id then
    delete from public.event_assignees ea
    where ea.event_id = new.id
      and (
        (select c.kind from public.calendars c where c.id = new.calendar_id) is distinct from 'group'
        or not exists (
          select 1 from public.calendar_members m
          where m.calendar_id = new.calendar_id and m.user_id = ea.user_id
        )
      );
  end if;
  return new;
end;
$$;

create trigger events_prune_assignees_on_calendar_change
  after update of calendar_id on public.events
  for each row execute function public.prune_assignees_on_event_calendar_change();
