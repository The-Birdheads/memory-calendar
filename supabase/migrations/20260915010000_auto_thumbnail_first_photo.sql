-- 予定に写真を追加しても振り返りタイムライン/画像タブに出てこない不具合の修正。
-- listMemoriesTimelineはis_thumbnail=trueの写真がある予定だけを表示するが、
-- attachPhotoは常にis_thumbnail=false(既定値)で挿入しており、ユーザーが
-- 予定詳細画面で明示的にサムネイルを選ばない限り一生表示されなかった。
-- その予定にまだサムネイルが無い場合は、追加された写真を自動でサムネイルに
-- する(2人目以降の写真が付く共有カレンダーでは、代表写真をどれにするかを
-- 引き続き明示的に選べる - 既にサムネイルがある場合は上書きしない)。

create or replace function public.set_first_photo_as_thumbnail()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.event_photos
    where event_id = new.event_id and is_thumbnail
  ) then
    new.is_thumbnail := true;
  end if;
  return new;
end;
$$;

create trigger set_first_photo_as_thumbnail_trigger
  before insert on public.event_photos
  for each row execute function public.set_first_photo_as_thumbnail();

-- 既存データの救済: サムネイル未設定のまま宙に浮いている予定について、
-- 最も古い写真を1枚サムネイルに昇格させる。
with earliest_photo_per_event as (
  select distinct on (event_id) id
  from public.event_photos
  where event_id not in (
    select event_id from public.event_photos where is_thumbnail
  )
  order by event_id, created_at asc
)
update public.event_photos
set is_thumbnail = true
where id in (select id from earliest_photo_per_event);
