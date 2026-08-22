-- タスク6.1: tagsスキーマとタグ作成を検証する

begin;
select plan(18);

select has_table('public', 'tags', 'tags テーブルが存在すること');
select has_column('public', 'tags', 'parent_id', 'tags.parent_id 列が存在すること');
select has_column('public', 'tags', 'level', 'tags.level 列が存在すること');
select has_column('public', 'tags', 'name', 'tags.name 列が存在すること');
select has_column('public', 'tags', 'color', 'tags.color 列が存在すること');
select col_is_pk('public', 'tags', 'id', 'tags.id が主キーであること');
select is(
  (select relrowsecurity from pg_class where oid = 'public.tags'::regclass),
  true,
  'tags テーブルで RLS が有効であること'
);
-- ポリシーの網羅的な一覧検証はタスク6.3(更新ポリシー追加)以降で行うためここでは個別に存在確認する
select ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tags' and policyname = 'tags_insert_member'
  ),
  'tags_insert_member ポリシーが定義されていること'
);
select ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tags' and policyname = 'tags_select_member'
  ),
  'tags_select_member ポリシーが定義されていること'
);
select has_function(
  'public', 'validate_tag_hierarchy',
  'validate_tag_hierarchy() 関数が存在すること'
);

-- セットアップ
set local role postgres;
insert into auth.users (id) values ('ffffffff-ffff-ffff-ffff-fffffffffff1');
set local role authenticated;
set local request.jwt.claim.sub = 'ffffffff-ffff-ffff-ffff-fffffffffff1';
insert into public.calendars (name) values ('タグ検証用') returning id \gset cal10_

-- 大分類タグの作成
insert into public.tags (calendar_id, level, name, color)
  values (:'cal10_id', 'major', '行事', '#ff0000')
  returning id \gset tagMajor_

select is(
  (select count(*) from public.tags where calendar_id = :'cal10_id'::uuid),
  1::bigint,
  '作成したタグがカレンダーのタグ一覧に表示されること'
);

-- 中分類タグ(大分類を親とする)の作成
insert into public.tags (calendar_id, level, name, color, parent_id)
  values (:'cal10_id', 'mid', '誕生日', '#00ff00', :'tagMajor_id')
  returning id \gset tagMid_

select is(
  (select parent_id from public.tags where id = :'tagMid_id'::uuid),
  :'tagMajor_id'::uuid,
  '中分類タグが指定した大分類タグに紐づくこと'
);

-- CHECK制約: 大分類タグは親を持てない
select throws_ok(
  $$ insert into public.tags (calendar_id, level, name, color, parent_id)
     values (:'cal10_id', 'major', '不正', '#123456', :'tagMajor_id') $$,
  '23514',
  null,
  '大分類タグに親を指定するとCHECK制約で拒否されること'
);

-- CHECK制約: 中分類タグは親が必須
select throws_ok(
  $$ insert into public.tags (calendar_id, level, name, color)
     values (:'cal10_id', 'mid', '不正', '#123456') $$,
  '23514',
  null,
  '中分類タグに親を指定しないとCHECK制約で拒否されること'
);

-- 色の形式チェック
select throws_ok(
  $$ insert into public.tags (calendar_id, level, name, color)
     values (:'cal10_id', 'major', '不正な色', 'red') $$,
  '23514',
  null,
  '色が#RRGGBB形式でない場合はCHECK制約で拒否されること'
);

-- トリガー: 小分類タグの親は中分類でなければならない(大分類を親にすると拒否)
select throws_ok(
  $$ insert into public.tags (calendar_id, level, name, color, parent_id)
     values (:'cal10_id', 'minor', '不正', '#123456', :'tagMajor_id') $$,
  'A0004',
  null,
  '小分類タグの親が中分類でない場合はトリガーで拒否されること'
);

-- 非メンバーは閲覧・作成できない
set local role postgres;
insert into auth.users (id) values ('ffffffff-ffff-ffff-ffff-fffffffffff2');
set local role authenticated;
set local request.jwt.claim.sub = 'ffffffff-ffff-ffff-ffff-fffffffffff2';
select is(
  (select count(*) from public.tags where calendar_id = :'cal10_id'::uuid),
  0::bigint,
  '非メンバーはタグを閲覧できないこと'
);
select throws_ok(
  $$ insert into public.tags (calendar_id, level, name, color)
     values (:'cal10_id', 'major', '不正', '#123456') $$,
  '42501',
  null,
  '非メンバーはタグを作成できないこと'
);

select * from finish();
rollback;
