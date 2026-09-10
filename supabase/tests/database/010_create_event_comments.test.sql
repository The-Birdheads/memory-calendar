-- タスク5.1: event_commentsスキーマとコメント投稿・表示を検証する

begin;
select plan(14);

select has_table('public', 'event_comments', 'event_comments テーブルが存在すること');
select has_column('public', 'event_comments', 'event_id', 'event_comments.event_id 列が存在すること');
select has_column('public', 'event_comments', 'user_id', 'event_comments.user_id 列が存在すること');
select has_column('public', 'event_comments', 'body', 'event_comments.body 列が存在すること');
select has_column('public', 'event_comments', 'created_at', 'event_comments.created_at 列が存在すること');
select col_is_pk('public', 'event_comments', 'id', 'event_comments.id が主キーであること');
select is(
  (select relrowsecurity from pg_class where oid = 'public.event_comments'::regclass),
  true,
  'event_comments テーブルで RLS が有効であること'
);
-- ポリシーの網羅的な一覧検証はタスク5.2(削除ポリシー追加)以降で行うためここでは個別に存在確認する
select ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'event_comments' and policyname = 'event_comments_insert_member'
  ),
  'event_comments_insert_member ポリシーが定義されていること'
);
select ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'event_comments' and policyname = 'event_comments_select_member'
  ),
  'event_comments_select_member ポリシーが定義されていること'
);

-- セットアップ: owner + viewerが所属するカレンダーと予定
set local role postgres;
insert into auth.users (id) values
  ('dddddddd-dddd-dddd-dddd-ddddddddddd1'), -- owner
  ('dddddddd-dddd-dddd-dddd-ddddddddddd2'), -- viewer
  ('dddddddd-dddd-dddd-dddd-ddddddddddd3'); -- 非メンバー

set local role authenticated;
set local request.jwt.claim.sub = 'dddddddd-dddd-dddd-dddd-ddddddddddd1';
insert into public.calendars (name) values ('コメント検証用') returning id \gset cal8_

set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role)
  values (:'cal8_id'::uuid, 'dddddddd-dddd-dddd-dddd-ddddddddddd2', 'viewer');

set local role authenticated;
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'cal8_id', 'コメント検証予定', '2026-09-12T10:00:00+00', '2026-09-12T11:00:00+00')
  returning id \gset event8_

-- viewerがコメントを投稿する
set local request.jwt.claim.sub = 'dddddddd-dddd-dddd-dddd-ddddddddddd2';
insert into public.event_comments (event_id, body)
  values (:'event8_id', '楽しみですね!');

select is(
  (select count(*) from public.event_comments where event_id = :'event8_id'::uuid),
  1::bigint,
  '投稿したコメントが保存されること'
);
select is(
  (select user_id from public.event_comments where event_id = :'event8_id'::uuid),
  'dddddddd-dddd-dddd-dddd-ddddddddddd2'::uuid,
  '投稿者が記録されること'
);

-- 別のカレンダーメンバー(owner)は投稿されたコメントを即座に閲覧できる
set local request.jwt.claim.sub = 'dddddddd-dddd-dddd-dddd-ddddddddddd1';
select is(
  (select count(*) from public.event_comments where event_id = :'event8_id'::uuid),
  1::bigint,
  '他のカレンダーメンバーが投稿されたコメントを閲覧できること'
);

-- 非メンバーは閲覧・投稿できない
set local request.jwt.claim.sub = 'dddddddd-dddd-dddd-dddd-ddddddddddd3';
select is(
  (select count(*) from public.event_comments where event_id = :'event8_id'::uuid),
  0::bigint,
  '非メンバーはコメントを閲覧できないこと'
);
select throws_ok(
  format(
    $$ insert into public.event_comments (event_id, body) values (%L, '不正な投稿') $$,
    :'event8_id'
  ),
  '42501',
  null,
  '非メンバーはコメントを投稿できないこと'
);

select * from finish();
rollback;
