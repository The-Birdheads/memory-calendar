-- タスク10.2: 食べる予定/食べたものの一覧共有(全メンバーの記録が一覧に含まれること)を検証する

begin;
select plan(4);

-- セットアップ: owner + viewerが所属するカレンダー
set local role postgres;
insert into auth.users (id) values
  ('22222222-2222-3333-4444-555555555551'), -- owner
  ('22222222-2222-3333-4444-555555555552'); -- viewer

set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-3333-4444-555555555551';
insert into public.calendars (name) values ('献立共有検証用') returning id \gset cal21_

set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role)
  values (:'cal21_id'::uuid, '22222222-2222-3333-4444-555555555552', 'viewer');

-- ownerが過去の献立を登録(実行日基準で相対指定 - 固定日付だと時間経過でテストが壊れる)
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-3333-4444-555555555551';
insert into public.meal_records (calendar_id, meal_date, slot, title)
  values (:'cal21_id', current_date - 30, 'breakfast', 'ownerのトースト');

-- viewerが未来の献立(食べる予定)を登録
set local request.jwt.claim.sub = '22222222-2222-3333-4444-555555555552';
insert into public.meal_records (calendar_id, meal_date, slot, title)
  values (:'cal21_id', current_date + 30, 'dinner', 'viewerのカレー');

-- ownerから見ると、両メンバーの記録が一覧に含まれる
set local request.jwt.claim.sub = '22222222-2222-3333-4444-555555555551';
select is(
  (select count(*) from public.meal_records where calendar_id = :'cal21_id'::uuid),
  2::bigint,
  '共有カレンダーの全メンバー(owner・viewer)の記録が一覧に含まれること'
);

-- 過去の記録のみを取得(食べたもの)
select is(
  (select count(*) from public.meal_records
     where calendar_id = :'cal21_id'::uuid and meal_date < current_date),
  1::bigint,
  'meal_dateが現在より過去の記録を「食べたもの」として抽出できること'
);

-- 未来の記録のみを取得(食べる予定)
select is(
  (select title from public.meal_records
     where calendar_id = :'cal21_id'::uuid and meal_date >= current_date),
  'viewerのカレー',
  'meal_dateが現在以降の記録を「食べる予定」として抽出できること'
);

-- viewerから見ても同様に両メンバーの記録が見える
set local request.jwt.claim.sub = '22222222-2222-3333-4444-555555555552';
select is(
  (select count(*) from public.meal_records where calendar_id = :'cal21_id'::uuid),
  2::bigint,
  'viewer側から見ても全メンバーの記録が一覧に含まれること'
);

select * from finish();
rollback;
