-- タスク10.1: meal_records/meal_tagsスキーマと区分別登録を検証する

begin;
select plan(21);

select has_table('public', 'meal_records', 'meal_records テーブルが存在すること');
select has_column('public', 'meal_records', 'meal_date', 'meal_records.meal_date 列が存在すること');
select has_column('public', 'meal_records', 'slot', 'meal_records.slot 列が存在すること');
select has_column('public', 'meal_records', 'rating', 'meal_records.rating 列が存在すること');
select has_column('public', 'meal_records', 'url', 'meal_records.url 列が存在すること');
select has_column('public', 'meal_records', 'memo', 'meal_records.memo 列が存在すること');
select is(
  (select relrowsecurity from pg_class where oid = 'public.meal_records'::regclass),
  true,
  'meal_records テーブルで RLS が有効であること'
);
-- 網羅的な一覧検証はタスク10.3(更新・削除ポリシー追加)以降で行うためここでは個別に存在確認する
select ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'meal_records' and policyname = 'meal_records_insert_member'
  ),
  'meal_records_insert_member ポリシーが定義されていること'
);
select ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'meal_records' and policyname = 'meal_records_select_member'
  ),
  'meal_records_select_member ポリシーが定義されていること'
);

select has_table('public', 'meal_tags', 'meal_tags テーブルが存在すること');
select has_table('public', 'meal_record_tags', 'meal_record_tags テーブルが存在すること');
select col_is_fk(
  'public', 'meal_record_tags', 'meal_tag_id',
  'meal_record_tags.meal_tag_id が外部キー(meal_tags参照)であること'
);

-- meal_recordsからtagsテーブルへの直接参照が存在しないこと(要件12.3: 予定用タグとの独立性)
select isnt(
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name in ('meal_records', 'meal_record_tags')
       and column_name = 'tag_id'),
  1::bigint,
  'meal_records/meal_record_tagsが予定用tagsのtag_id列を持たないこと(独立管理)'
);

-- セットアップ: owner + viewerが所属するカレンダー
set local role postgres;
insert into auth.users (id) values
  ('11111111-1111-2222-3333-444444444441'), -- owner
  ('11111111-1111-2222-3333-444444444442'); -- viewer

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-2222-3333-444444444441';
insert into public.calendars (name) values ('献立検証用') returning id \gset cal20_

set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role)
  values (:'cal20_id'::uuid, '11111111-1111-2222-3333-444444444442', 'viewer');

-- 献立タグは予定用タグとは独立して作成・管理される
set local role authenticated;
insert into public.meal_tags (calendar_id, name) values (:'cal20_id', '和食') returning id \gset mealTag20_

select is(
  (select count(*) from public.meal_tags where calendar_id = :'cal20_id'::uuid),
  1::bigint,
  '献立タグが予定用タグとは独立して作成できること'
);

-- 朝食区分での登録(タイトル・点数・URL・タグ・メモ)
insert into public.meal_records (calendar_id, meal_date, slot, title, rating, url, memo)
  values (:'cal20_id', '2026-08-20', 'breakfast', 'トースト', 4, 'https://example.com/toast', '美味しかった')
  returning id \gset meal20_
insert into public.meal_record_tags (meal_record_id, meal_tag_id) values (:'meal20_id', :'mealTag20_id');

select is(
  (select count(*) from public.meal_records where calendar_id = :'cal20_id'::uuid),
  1::bigint,
  '区分(朝食)での献立記録が登録されること'
);
select is(
  (select count(*) from public.meal_record_tags where meal_record_id = :'meal20_id'::uuid),
  1::bigint,
  '献立記録に献立タグが紐づくこと'
);

-- CHECK制約: slotは4区分以外を許可しない
select throws_ok(
  format(
    $$ insert into public.meal_records (calendar_id, meal_date, slot, title)
       values (%L, '2026-08-20', 'brunch', '不正な区分') $$,
    :'cal20_id'
  ),
  '23514',
  null,
  'slotが4区分以外の場合はCHECK制約で拒否されること'
);

-- CHECK制約: ratingは1〜5の範囲
select throws_ok(
  format(
    $$ insert into public.meal_records (calendar_id, meal_date, slot, title, rating)
       values (%L, '2026-08-20', 'lunch', '不正な点数', 6) $$,
    :'cal20_id'
  ),
  '23514',
  null,
  'ratingが1〜5の範囲外の場合はCHECK制約で拒否されること'
);

-- 他のカレンダーメンバーも献立記録・タグを閲覧できる
set local request.jwt.claim.sub = '11111111-1111-2222-3333-444444444442';
select is(
  (select count(*) from public.meal_records where calendar_id = :'cal20_id'::uuid),
  1::bigint,
  '他のカレンダーメンバーも献立記録を閲覧できること'
);

-- 非メンバーは閲覧・登録できない
set local role postgres;
insert into auth.users (id) values ('11111111-1111-2222-3333-444444444443');
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-2222-3333-444444444443';
select is(
  (select count(*) from public.meal_records where calendar_id = :'cal20_id'::uuid),
  0::bigint,
  '非メンバーは献立記録を閲覧できないこと'
);
select throws_ok(
  format(
    $$ insert into public.meal_records (calendar_id, meal_date, slot, title)
       values (%L, '2026-08-20', 'snack', '不正な登録') $$,
    :'cal20_id'
  ),
  '42501',
  null,
  '非メンバーは献立記録を登録できないこと'
);

select * from finish();
rollback;
