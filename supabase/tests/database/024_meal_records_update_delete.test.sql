-- タスク10.3: 献立記録の編集・削除を検証する

begin;
select plan(7);

select policies_are(
  'public', 'meal_records',
  array[
    'meal_records_delete_member',
    'meal_records_insert_member',
    'meal_records_select_member',
    'meal_records_update_member'
  ],
  'meal_records に更新・削除ポリシーを含む想定通りのRLSポリシーが定義されていること'
);

-- セットアップ: owner + viewerが所属するカレンダーと献立記録
set local role postgres;
insert into auth.users (id) values
  ('33333333-3333-4444-5555-666666666661'), -- owner
  ('33333333-3333-4444-5555-666666666662'); -- viewer

set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-4444-5555-666666666661';
insert into public.calendars (name) values ('献立編集検証用') returning id \gset cal22_

set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role)
  values (:'cal22_id'::uuid, '33333333-3333-4444-5555-666666666662', 'viewer');

set local role authenticated;
insert into public.meal_records (calendar_id, meal_date, slot, title)
  values (:'cal22_id', '2026-08-20', 'breakfast', 'トースト')
  returning id \gset meal22_

-- 別のカレンダーメンバー(viewer)が編集する
set local request.jwt.claim.sub = '33333333-3333-4444-5555-666666666662';
update public.meal_records set title = 'トーストとコーヒー' where id = :'meal22_id'::uuid;

select is(
  (select title from public.meal_records where id = :'meal22_id'::uuid),
  'トーストとコーヒー',
  '献立記録を編集できること'
);

-- 編集後、一覧表示(同じクエリ)に変更が反映される
select is(
  (select count(*) from public.meal_records
     where calendar_id = :'cal22_id'::uuid and title = 'トーストとコーヒー'),
  1::bigint,
  '編集後、一覧表示に変更が反映されること'
);

-- 非メンバーは編集・削除できない
set local role postgres;
insert into auth.users (id) values ('33333333-3333-4444-5555-666666666663');
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-4444-5555-666666666663';
update public.meal_records set title = '不正な変更' where id = :'meal22_id'::uuid;

select is(
  (select title from public.meal_records where id = :'meal22_id'::uuid),
  'トーストとコーヒー',
  '非メンバーが編集を試みても変更されないこと'
);

delete from public.meal_records where id = :'meal22_id'::uuid;
select ok(
  exists(select 1 from public.meal_records where id = :'meal22_id'::uuid),
  '非メンバーが削除を試みても削除されないこと'
);

-- カレンダーメンバーによる削除は成功する
set local request.jwt.claim.sub = '33333333-3333-4444-5555-666666666661';
delete from public.meal_records where id = :'meal22_id'::uuid;

select ok(
  not exists(select 1 from public.meal_records where id = :'meal22_id'::uuid),
  'カレンダーメンバーによる削除は成功すること'
);

-- 削除後、一覧表示から消える
select is(
  (select count(*) from public.meal_records where calendar_id = :'cal22_id'::uuid),
  0::bigint,
  '削除後、一覧表示から消えること'
);

select * from finish();
rollback;
