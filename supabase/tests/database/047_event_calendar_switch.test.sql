-- 予定の所属カレンダー切り替え(events.calendar_id の直接UPDATE)を検証する。
-- 専用のRPCは無く、既存の events_update_member ポリシー(using: 元のcalendar_id
-- のメンバーであること / with check: 新しいcalendar_idのメンバーであること)を
-- そのまま使う設計のため、そのポリシーがこのユースケースで狙い通り機能することを
-- 確認する。

begin;
select plan(8);

set local role postgres;
insert into auth.users (id) values
  ('c1c1c1c1-0000-0000-0000-000000000001'), -- 両方のカレンダーのメンバー(切り替えを行う本人)
  ('c1c1c1c1-0000-0000-0000-000000000002'), -- 元のカレンダーのみのメンバー
  ('c1c1c1c1-0000-0000-0000-000000000003'), -- 新しいカレンダーのみのメンバー
  ('c1c1c1c1-0000-0000-0000-000000000004'); -- どちらのメンバーでもない

set local role authenticated;
set local request.jwt.claim.sub = 'c1c1c1c1-0000-0000-0000-000000000001';
insert into public.calendars (name) values ('元のカレンダー') returning id \gset from_
insert into public.calendars (name) values ('新しいカレンダー') returning id \gset to_

set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role) values
  (:'from_id'::uuid, 'c1c1c1c1-0000-0000-0000-000000000002', 'viewer'),
  (:'to_id'::uuid, 'c1c1c1c1-0000-0000-0000-000000000003', 'viewer');

set local role authenticated;
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'from_id'::uuid, '切り替え検証予定', '2026-10-01T10:00:00+00', '2026-10-01T11:00:00+00')
  returning id \gset event_

-- 元のカレンダーのみのメンバー(新しいカレンダーには入っていない)は切り替えられない。
-- 対象行自体はusingを通る(元のカレンダーのメンバーだから)が、更新後の行が
-- with checkを満たさない(新しいカレンダーのメンバーではない)ためRLS違反(42501)になる。
set local request.jwt.claim.sub = 'c1c1c1c1-0000-0000-0000-000000000002';
select throws_ok(
  format($$ update public.events set calendar_id = %L::uuid where id = %L::uuid $$, :'to_id', :'event_id'),
  '42501',
  null,
  '切り替え先カレンダーのメンバーでない場合、UPDATEはRLS(with check)で拒否されること'
);

set local role postgres;
select is(
  (select calendar_id from public.events where id = :'event_id'::uuid),
  :'from_id'::uuid,
  '拒否された場合、calendar_idは変更されていないこと'
);

-- どちらのカレンダーのメンバーでもない場合も何もできない
set local role authenticated;
set local request.jwt.claim.sub = 'c1c1c1c1-0000-0000-0000-000000000004';
update public.events set calendar_id = :'to_id'::uuid where id = :'event_id'::uuid;

set local role postgres;
select is(
  (select calendar_id from public.events where id = :'event_id'::uuid),
  :'from_id'::uuid,
  'どちらのカレンダーにも属さない場合、calendar_idは変更されないこと(usingで対象行が見えない)'
);

-- 両方のカレンダーのメンバーである本人は切り替えられる
set local role authenticated;
set local request.jwt.claim.sub = 'c1c1c1c1-0000-0000-0000-000000000001';
update public.events set calendar_id = :'to_id'::uuid where id = :'event_id'::uuid;

set local role postgres;
select is(
  (select calendar_id from public.events where id = :'event_id'::uuid),
  :'to_id'::uuid,
  '切り替え元・切り替え先の両方のメンバーであれば、calendar_idを変更できること'
);

-- 切り替え後、元のカレンダーのメンバーはもうこの予定を見られない
set local role authenticated;
set local request.jwt.claim.sub = 'c1c1c1c1-0000-0000-0000-000000000002';
select is(
  (select count(*) from public.events where id = :'event_id'::uuid),
  0::bigint,
  '切り替え後、元のカレンダーのメンバーはこの予定を見られなくなること'
);

-- 切り替え後、新しいカレンダーのメンバーはこの予定を見られる
set local request.jwt.claim.sub = 'c1c1c1c1-0000-0000-0000-000000000003';
select is(
  (select count(*) from public.events where id = :'event_id'::uuid),
  1::bigint,
  '切り替え後、新しいカレンダーのメンバーはこの予定を見られるようになること'
);

-- 本人(両方のメンバー)からは引き続き見える
set local request.jwt.claim.sub = 'c1c1c1c1-0000-0000-0000-000000000001';
select is(
  (select count(*) from public.events where id = :'event_id'::uuid),
  1::bigint,
  '切り替えを行った本人からは引き続きこの予定が見えること'
);

-- 予定のcreated_by/updated_byはカレンダー切り替えでも変わらない(移動しただけで作成者は不変)
set local role postgres;
select is(
  (select created_by from public.events where id = :'event_id'::uuid),
  'c1c1c1c1-0000-0000-0000-000000000001'::uuid,
  'カレンダー切り替えでもcreated_byは不変であること'
);

select * from finish();
rollback;
