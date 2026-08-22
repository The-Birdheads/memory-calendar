-- タスク6.1: tagsスキーマ(大/中/小の3階層)とタグ作成

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  parent_id uuid references public.tags (id) on delete cascade,
  level text not null check (level in ('major', 'mid', 'minor')),
  name text not null,
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  check (
    (level = 'major' and parent_id is null)
    or (level in ('mid', 'minor') and parent_id is not null)
  )
);

alter table public.tags enable row level security;

create index tags_calendar_id_parent_id_idx on public.tags (calendar_id, parent_id);

-- 階層整合性: mid の親は major、minor の親は mid でなければならない(単一行のCHECK制約では表現できないためトリガーで検証する)
create or replace function public.validate_tag_hierarchy()
returns trigger
language plpgsql
as $$
declare
  v_parent_level text;
begin
  if new.parent_id is not null then
    select level into v_parent_level from public.tags where id = new.parent_id;

    if new.level = 'mid' and v_parent_level <> 'major' then
      raise exception 'mid tag must have a major parent' using errcode = 'A0004';
    end if;

    if new.level = 'minor' and v_parent_level <> 'mid' then
      raise exception 'minor tag must have a mid parent' using errcode = 'A0004';
    end if;
  end if;

  return new;
end;
$$;

create trigger validate_tag_hierarchy_trigger
  before insert or update on public.tags
  for each row execute function public.validate_tag_hierarchy();

-- tags: カレンダーメンバーのみ閲覧・作成可能
create policy tags_select_member
  on public.tags
  for select
  to authenticated
  using (public.is_calendar_member(calendar_id, auth.uid()));

create policy tags_insert_member
  on public.tags
  for insert
  to authenticated
  with check (public.is_calendar_member(calendar_id, auth.uid()));
