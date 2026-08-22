-- タスク7.1: タグ絞り込み(階層を問わない再帰CTE)による過去予定の一覧取得を検証する

begin;
select plan(8);

select has_function(
  'public', 'list_past_events_by_tag',
  'list_past_events_by_tag() 関数が存在すること'
);

-- セットアップ: owner + viewerが所属するカレンダー、大/中/小の3階層タグ
set local role postgres;
insert into auth.users (id) values
  ('44444444-5555-6666-7777-888888888881'), -- owner
  ('44444444-5555-6666-7777-888888888882'); -- viewer

set local role authenticated;
set local request.jwt.claim.sub = '44444444-5555-6666-7777-888888888881';
insert into public.calendars (name) values ('振り返り検証用') returning id \gset cal14_

set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role)
  values (:'cal14_id'::uuid, '44444444-5555-6666-7777-888888888882', 'viewer');

set local role authenticated;
insert into public.tags (calendar_id, level, name, color)
  values (:'cal14_id', 'major', '行事', '#ff0000') returning id \gset tagMajor15_
insert into public.tags (calendar_id, level, name, color, parent_id)
  values (:'cal14_id', 'mid', '誕生日', '#00ff00', :'tagMajor15_id') returning id \gset tagMid15_
insert into public.tags (calendar_id, level, name, color, parent_id)
  values (:'cal14_id', 'minor', '家族の誕生日', '#0000ff', :'tagMid15_id') returning id \gset tagMinor15_

-- 過去の予定(小分類タグを付与)と、未来の予定(同じ小分類タグを付与)
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'cal14_id', '過去の誕生日会', '2026-01-01T10:00:00+00', '2026-01-01T11:00:00+00')
  returning id \gset pastEvent15_
insert into public.event_tags (event_id, tag_id) values (:'pastEvent15_id', :'tagMinor15_id');

insert into public.events (calendar_id, title, start_at, end_at)
  values (:'cal14_id', '未来の誕生日会', '2030-01-01T10:00:00+00', '2030-01-01T11:00:00+00')
  returning id \gset futureEvent15_
insert into public.event_tags (event_id, tag_id) values (:'futureEvent15_id', :'tagMinor15_id');

-- 小分類タグと無関係な過去の予定
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'cal14_id', '無関係な過去の予定', '2026-02-01T10:00:00+00', '2026-02-01T11:00:00+00')
  returning id \gset unrelatedEvent15_

-- タグ未指定: 過去の予定のみ(未来は含まれない)
select is(
  (select count(*) from public.list_past_events_by_tag(:'cal14_id'::uuid)),
  2::bigint,
  'タグ未指定時は全過去予定(未来は除く)が返ること'
);

-- 中分類タグで絞り込むと、配下の小分類タグ付き過去予定が含まれる(階層を問わない絞り込み)
select is(
  (select count(*) from public.list_past_events_by_tag(:'cal14_id'::uuid, :'tagMid15_id'::uuid)),
  1::bigint,
  '中分類タグで絞り込むと配下の小分類タグ付き過去予定が含まれること'
);
select is(
  (select title from public.list_past_events_by_tag(:'cal14_id'::uuid, :'tagMid15_id'::uuid)),
  '過去の誕生日会',
  '中分類タグでの絞り込み結果が正しいこと(未来の予定は含まれない)'
);

-- 大分類タグで絞り込んでも同様に配下(中分類経由の小分類)の過去予定が含まれる
select is(
  (select count(*) from public.list_past_events_by_tag(:'cal14_id'::uuid, :'tagMajor15_id'::uuid)),
  1::bigint,
  '大分類タグで絞り込むと配下の中分類・小分類タグ付き過去予定が含まれること'
);

-- 無関係なタグでは該当0件
insert into public.tags (calendar_id, level, name, color)
  values (:'cal14_id', 'major', '無関係タグ', '#123456') returning id \gset tagUnrelated15_
select is(
  (select count(*) from public.list_past_events_by_tag(:'cal14_id'::uuid, :'tagUnrelated15_id'::uuid)),
  0::bigint,
  '該当する予定が1件も存在しない場合は0件が返ること'
);

-- 別のカレンダーメンバー(viewer)でも同様に取得できる
set local request.jwt.claim.sub = '44444444-5555-6666-7777-888888888882';
select is(
  (select count(*) from public.list_past_events_by_tag(:'cal14_id'::uuid)),
  2::bigint,
  '他のカレンダーメンバーも過去予定一覧を取得できること'
);

-- 非メンバーは取得できない
set local role postgres;
insert into auth.users (id) values ('44444444-5555-6666-7777-888888888883');
set local role authenticated;
set local request.jwt.claim.sub = '44444444-5555-6666-7777-888888888883';
select throws_ok(
  $$ select * from public.list_past_events_by_tag(:'cal14_id'::uuid) $$,
  '42501',
  null,
  '非メンバーは過去予定一覧を取得できないこと'
);

select * from finish();
rollback;
