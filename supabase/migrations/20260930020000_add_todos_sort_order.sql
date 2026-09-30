-- ToDoの並び順を明示的に管理する。これまでORDER BYを指定しておらず、
-- Postgresの物理的な行順(更新のたびに変わりうる)に依存していたため、
-- 一覧を開くたびに並びがぶれて見えていた。
--
-- sort_orderは実数(フラクショナルインデックス)にして、ドラッグ&ドロップで
-- 1件だけ並び替える時に前後の値の中間値を入れるだけで済む(他の行を
-- 一括で更新し直さずに済む)ようにする。既存行は作成日時の昇順で
-- 1,2,3...を割り当ててバックフィルする。event_idごとに独立した並び
-- (未紐付けToDoはevent_id=nullでひとまとめ)。

alter table public.todos add column sort_order double precision;

update public.todos t
set sort_order = sub.rn
from (
  select id, row_number() over (partition by event_id order by created_at, id) as rn
  from public.todos
) sub
where t.id = sub.id;

alter table public.todos alter column sort_order set not null;

create or replace function public.set_todo_sort_order()
returns trigger
language plpgsql
as $$
begin
  if new.sort_order is null then
    select coalesce(max(sort_order), 0) + 1
    into new.sort_order
    from public.todos
    where event_id is not distinct from new.event_id;
  end if;
  return new;
end;
$$;

create trigger set_todo_sort_order_trigger
  before insert on public.todos
  for each row execute function public.set_todo_sort_order();
