-- スタンプは1人1予定につき最大1件までとし、同じスタンプの再押下で取り消し、
-- 別スタンプの押下で切り替えができるようにする

-- 旧仕様(1人が同じ予定に複数スタンプを付与できた)で作られた既存データがある場合、
-- そのままでは (event_id, user_id) の一意制約を追加できない。重複がある場合は
-- 最新の1件だけを残し、それ以外を削除しておく。
delete from public.event_reactions a
using public.event_reactions b
where a.event_id = b.event_id
  and a.user_id = b.user_id
  and (a.created_at, a.id) < (b.created_at, b.id);

alter table public.event_reactions
  add constraint event_reactions_event_id_user_id_key unique (event_id, user_id);

-- event_reactions: 自分が付与したスタンプのみ削除(取り消し)・変更(切り替え)できる
create policy event_reactions_delete_own
  on public.event_reactions
  for delete
  to authenticated
  using (user_id = auth.uid());

create policy event_reactions_update_own
  on public.event_reactions
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
