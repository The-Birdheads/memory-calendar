-- タスク: スタンプの1人1件制限と、取り消し・切り替えのRLSを検証する

begin;
select plan(6);

select col_is_unique(
  'public', 'event_reactions', array['event_id', 'user_id'],
  'event_reactions は (event_id, user_id) の組み合わせが一意であること'
);
select policies_are(
  'public', 'event_reactions',
  array['event_reactions_delete_own', 'event_reactions_insert_member', 'event_reactions_select_member', 'event_reactions_update_own'],
  'event_reactions に削除・更新ポリシーを含む想定通りのRLSポリシーが定義されていること'
);

-- セットアップ: owner + viewerが所属するカレンダーと予定
set local role postgres;
insert into auth.users (id) values
  ('ffffffff-ffff-ffff-ffff-fffffffffff1'), -- owner
  ('ffffffff-ffff-ffff-ffff-fffffffffff2'); -- viewer

set local role authenticated;
set local request.jwt.claim.sub = 'ffffffff-ffff-ffff-ffff-fffffffffff1';
insert into public.calendars (name) values ('スタンプ切替検証用') returning id \gset cal10_

set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role)
  values (:'cal10_id'::uuid, 'ffffffff-ffff-ffff-ffff-fffffffffff2', 'viewer');

set local role authenticated;
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'cal10_id', 'スタンプ切替検証予定', '2026-09-13T10:00:00+00', '2026-09-13T11:00:00+00')
  returning id \gset event10_

-- viewerがスタンプを付与する
set local request.jwt.claim.sub = 'ffffffff-ffff-ffff-ffff-fffffffffff2';
insert into public.event_reactions (event_id, stamp_type)
  values (:'event10_id', '👍')
  returning id \gset reaction10_

-- 同じ予定に2件目のスタンプを挿入しようとすると一意制約違反になる
-- (event_id はサブクエリで既存行から取得する - psqlの変数展開 :'var' は $$ ... $$ の中では
-- 効かない場合があるため、throws_ok に渡すSQL文字列の中では変数を使わない)
select throws_ok(
  $$ insert into public.event_reactions (event_id, stamp_type)
     select event_id, '❤️' from public.event_reactions where stamp_type = '👍' $$,
  '23505',
  null,
  '同じユーザーが同じ予定に2件目のスタンプを挿入しようとすると一意制約違反になること'
);

-- 他人(owner)は自分のスタンプを削除できない
set local request.jwt.claim.sub = 'ffffffff-ffff-ffff-ffff-fffffffffff1';
delete from public.event_reactions where id = :'reaction10_id'::uuid;
select is(
  (select count(*) from public.event_reactions where id = :'reaction10_id'::uuid),
  1::bigint,
  '他人が付与したスタンプは削除できないこと'
);

-- 自分のスタンプは別の種類に切り替えられる
set local request.jwt.claim.sub = 'ffffffff-ffff-ffff-ffff-fffffffffff2';
update public.event_reactions set stamp_type = '❤️' where id = :'reaction10_id'::uuid;
select is(
  (select stamp_type from public.event_reactions where id = :'reaction10_id'::uuid),
  '❤️',
  '自分のスタンプは別の種類に切り替えられること'
);

-- 自分のスタンプは削除(取り消し)できる
delete from public.event_reactions where id = :'reaction10_id'::uuid;
select is(
  (select count(*) from public.event_reactions where id = :'reaction10_id'::uuid),
  0::bigint,
  '自分のスタンプは削除(取り消し)できること'
);

select * from finish();
rollback;
