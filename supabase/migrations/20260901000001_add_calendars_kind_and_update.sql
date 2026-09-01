-- カレンダーに種別(個人用/グループ用)を追加し、名称・種別の更新をオーナーのみに許可する

alter table public.calendars
  add column kind text not null default 'group' check (kind in ('personal', 'group'));

-- calendars: 名称・種別の更新はオーナーのみ許可する
create policy calendars_update_owner
  on public.calendars
  for update
  to authenticated
  using (public.is_calendar_owner(id, auth.uid()))
  with check (public.is_calendar_owner(id, auth.uid()));
