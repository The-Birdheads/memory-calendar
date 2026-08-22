-- タスク6.3: タグ編集(名称・色・階層)と既存の紐付け表示への反映を検証する

begin;
select plan(9);

-- 網羅的な一覧検証はタスク6.4(削除ポリシー追加)以降で行うためここでは個別に存在確認する
select ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tags' and policyname = 'tags_update_member'
  ),
  'tags_update_member ポリシーが定義されていること'
);

-- セットアップ: owner + viewerが所属するカレンダー、タグ、予定
set local role postgres;
insert into auth.users (id) values
  ('22222222-3333-4444-5555-666666666661'), -- owner
  ('22222222-3333-4444-5555-666666666662'); -- viewer

set local role authenticated;
set local request.jwt.claim.sub = '22222222-3333-4444-5555-666666666661';
insert into public.calendars (name) values ('タグ編集検証用') returning id \gset cal12_

set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role)
  values (:'cal12_id'::uuid, '22222222-3333-4444-5555-666666666662', 'viewer');

set local role authenticated;
insert into public.tags (calendar_id, level, name, color)
  values (:'cal12_id', 'major', '行事', '#ff0000') returning id \gset tag13_
insert into public.tags (calendar_id, level, name, color)
  values (:'cal12_id', 'major', '外出', '#00ff00') returning id \gset tagParent13_

insert into public.events (calendar_id, title, start_at, end_at)
  values (:'cal12_id', 'タグ編集検証予定', '2026-09-16T10:00:00+00', '2026-09-16T11:00:00+00')
  returning id \gset event13_
insert into public.event_tags (event_id, tag_id) values (:'event13_id', :'tag13_id');

-- 別のカレンダーメンバー(viewer)が名称・色を編集する
set local request.jwt.claim.sub = '22222222-3333-4444-5555-666666666662';
update public.tags set name = '行楽', color = '#123456' where id = :'tag13_id'::uuid;

select is(
  (select name from public.tags where id = :'tag13_id'::uuid),
  '行楽',
  'タグの名称を編集できること'
);
select is(
  (select color from public.tags where id = :'tag13_id'::uuid),
  '#123456',
  'タグの色を編集できること'
);

-- 編集後、既存の予定への紐付け表示(event_tags経由の結合)にも変更が反映される
select is(
  (select t.name from public.event_tags et join public.tags t on t.id = et.tag_id
     where et.event_id = :'event13_id'::uuid),
  '行楽',
  '編集後、既存の予定への紐付け表示にも名称の変更が反映されること'
);
select is(
  (select t.color from public.event_tags et join public.tags t on t.id = et.tag_id
     where et.event_id = :'event13_id'::uuid),
  '#123456',
  '編集後、既存の予定への紐付け表示にも色の変更が反映されること'
);

-- 階層(大分類→中分類)の編集
update public.tags set level = 'mid', parent_id = :'tagParent13_id' where id = :'tag13_id'::uuid;

select is(
  (select level from public.tags where id = :'tag13_id'::uuid),
  'mid',
  'タグの階層(level)を編集できること'
);
select is(
  (select parent_id from public.tags where id = :'tag13_id'::uuid),
  :'tagParent13_id'::uuid,
  'タグの親(parent_id)を編集できること'
);

-- CHECK制約: 編集時も大分類は親を持てない
select throws_ok(
  $$ update public.tags set level = 'major' where id = :'tag13_id' $$,
  '23514',
  null,
  '編集で大分類にする際、親が残っているとCHECK制約で拒否されること'
);

-- 非メンバーは編集できない
set local role postgres;
insert into auth.users (id) values ('22222222-3333-4444-5555-666666666663');
set local role authenticated;
set local request.jwt.claim.sub = '22222222-3333-4444-5555-666666666663';
update public.tags set name = '不正な変更' where id = :'tag13_id'::uuid;

select is(
  (select name from public.tags where id = :'tag13_id'::uuid),
  '行楽',
  '非メンバーが編集を試みても変更されないこと'
);

select * from finish();
rollback;
