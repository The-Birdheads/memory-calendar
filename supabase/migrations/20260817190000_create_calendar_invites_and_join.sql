-- タスク3.2: calendar_invitesスキーマと招待コード発行・招待経由の参加(RPC join_by_invite)

-- owner/editorロール判定ヘルパー(招待発行の権限チェックに使用)
create or replace function public.is_calendar_owner_or_editor(p_calendar_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return exists (
    select 1
    from public.calendar_members cm
    where cm.calendar_id = p_calendar_id
      and cm.user_id = p_user_id
      and cm.role in ('owner', 'editor')
  );
end;
$$;

revoke all on function public.is_calendar_owner_or_editor(uuid, uuid) from public;
grant execute on function public.is_calendar_owner_or_editor(uuid, uuid) to anon, authenticated;

-- calendar_invites: 招待コードは推測困難な形式(UUIDv4相当)とし、有効期限を設ける
create table public.calendar_invites (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  code text not null unique default gen_random_uuid()::text,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.calendar_invites enable row level security;

create index calendar_invites_calendar_id_idx on public.calendar_invites (calendar_id);

-- 招待の閲覧・発行はowner/editorのみ許可する
create policy calendar_invites_select_owner_or_editor
  on public.calendar_invites
  for select
  to authenticated
  using (public.is_calendar_owner_or_editor(calendar_id, auth.uid()));

create policy calendar_invites_insert_owner_or_editor
  on public.calendar_invites
  for insert
  to authenticated
  with check (
    public.is_calendar_owner_or_editor(calendar_id, auth.uid())
    and created_by = auth.uid()
  );

-- 招待コードでの参加。招待コードが存在しない場合はA0001、有効期限切れの場合はA0002を返す。
-- 既にメンバーの場合は既存のロールを維持したまま冪等に成功する。
create or replace function public.join_by_invite(p_code text)
returns public.calendar_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.calendar_invites;
  v_member public.calendar_members;
begin
  select * into v_invite
  from public.calendar_invites
  where code = p_code;

  if not found then
    raise exception 'invite_not_found' using errcode = 'A0001';
  end if;

  if v_invite.expires_at < now() then
    raise exception 'invite_expired' using errcode = 'A0002';
  end if;

  insert into public.calendar_members (calendar_id, user_id, role)
  values (v_invite.calendar_id, auth.uid(), 'viewer')
  on conflict (calendar_id, user_id) do nothing
  returning * into v_member;

  if v_member is null then
    select * into v_member
    from public.calendar_members
    where calendar_id = v_invite.calendar_id
      and user_id = auth.uid();
  end if;

  return v_member;
end;
$$;

revoke all on function public.join_by_invite(text) from public;
grant execute on function public.join_by_invite(text) to authenticated;
