-- タスク5.2: event_reactionsスキーマ(スタンプ付与)と、自分のコメントの削除を検証する

begin;
select plan(12);

select has_table('public', 'event_reactions', 'event_reactions テーブルが存在すること');
select has_column('public', 'event_reactions', 'event_id', 'event_reactions.event_id 列が存在すること');
select has_column('public', 'event_reactions', 'user_id', 'event_reactions.user_id 列が存在すること');
select has_column('public', 'event_reactions', 'stamp_type', 'event_reactions.stamp_type 列が存在すること');
select col_is_pk('public', 'event_reactions', 'id', 'event_reactions.id が主キーであること');
select is(
  (select relrowsecurity from pg_class where oid = 'public.event_reactions'::regclass),
  true,
  'event_reactions テーブルで RLS が有効であること'
);
select policies_are(
  'public', 'event_reactions',
  array[
    'event_reactions_insert_member', 'event_reactions_select_member',
    'event_reactions_update_own', 'event_reactions_delete_own'
  ],
  'event_reactions に想定通りのRLSポリシーが定義されていること'
);
select policies_are(
  'public', 'event_comments',
  array['event_comments_delete_own', 'event_comments_insert_member', 'event_comments_select_member'],
  'event_comments に削除ポリシーを含む想定通りのRLSポリシーが定義されていること'
);

-- セットアップ: owner + viewerが所属するカレンダーと予定
set local role postgres;
insert into auth.users (id) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1'), -- owner
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2'); -- viewer

set local role authenticated;
set local request.jwt.claim.sub = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1';
insert into public.calendars (name) values ('スタンプ検証用') returning id \gset cal9_

set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role)
  values (:'cal9_id'::uuid, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2', 'viewer');

set local role authenticated;
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'cal9_id', 'スタンプ検証予定', '2026-09-13T10:00:00+00', '2026-09-13T11:00:00+00')
  returning id \gset event9_

-- viewerがスタンプを付与する
set local request.jwt.claim.sub = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2';
insert into public.event_reactions (event_id, stamp_type)
  values (:'event9_id', '👍');

select is(
  (select count(*) from public.event_reactions where event_id = :'event9_id'::uuid),
  1::bigint,
  '付与したスタンプが保存されること'
);

-- 別のカレンダーメンバー(owner)はスタンプを即座に閲覧できる
set local request.jwt.claim.sub = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1';
select is(
  (select count(*) from public.event_reactions where event_id = :'event9_id'::uuid),
  1::bigint,
  '他のカレンダーメンバーが付与されたスタンプを閲覧できること(予定詳細への反映)'
);

-- コメントの削除: 自分が投稿したコメントのみ削除できる
insert into public.event_comments (event_id, body) values (:'event9_id', 'ownerのコメント');
set local request.jwt.claim.sub = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2';
insert into public.event_comments (event_id, body) values (:'event9_id', 'viewerのコメント');

-- 他人のコメントは削除できない
delete from public.event_comments where event_id = :'event9_id'::uuid and body = 'ownerのコメント';
select is(
  (select count(*) from public.event_comments where body = 'ownerのコメント'),
  1::bigint,
  '他人が投稿したコメントは削除できないこと'
);

-- 自分のコメントは削除でき、一覧から消える
delete from public.event_comments where event_id = :'event9_id'::uuid and body = 'viewerのコメント';
select is(
  (select count(*) from public.event_comments where body = 'viewerのコメント'),
  0::bigint,
  '自分が投稿したコメントは削除でき、一覧から消えること'
);

select * from finish();
rollback;
