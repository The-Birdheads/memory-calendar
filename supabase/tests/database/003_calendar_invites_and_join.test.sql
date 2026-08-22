-- タスク3.2: calendar_invitesスキーマと招待コード発行・招待経由の参加(join_by_invite)を検証する

begin;
select plan(21);

-- calendar_invites テーブルの構造
select has_table('public', 'calendar_invites', 'calendar_invites テーブルが存在すること');
select has_column('public', 'calendar_invites', 'calendar_id', 'calendar_invites.calendar_id 列が存在すること');
select has_column('public', 'calendar_invites', 'code', 'calendar_invites.code 列が存在すること');
select has_column('public', 'calendar_invites', 'expires_at', 'calendar_invites.expires_at 列が存在すること');
select has_column('public', 'calendar_invites', 'created_by', 'calendar_invites.created_by 列が存在すること');
select col_is_pk('public', 'calendar_invites', 'id', 'calendar_invites.id が主キーであること');
select col_is_fk(
  'public', 'calendar_invites', 'calendar_id',
  'calendar_invites.calendar_id が外部キー(calendars参照)であること'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.calendar_invites'::regclass),
  true,
  'calendar_invites テーブルで RLS が有効であること'
);
select policies_are(
  'public', 'calendar_invites',
  array['calendar_invites_insert_owner_or_editor', 'calendar_invites_select_owner_or_editor'],
  'calendar_invites に想定通りのRLSポリシーが定義されていること'
);

-- ヘルパー関数・RPC関数の存在確認
select has_function(
  'public', 'is_calendar_owner_or_editor', array['uuid', 'uuid'],
  'is_calendar_owner_or_editor(uuid, uuid) 関数が存在すること'
);
select function_returns(
  'public', 'is_calendar_owner_or_editor', array['uuid', 'uuid'], 'boolean',
  'is_calendar_owner_or_editor は boolean を返すこと'
);
select has_function(
  'public', 'join_by_invite', array['text'],
  'join_by_invite(text) 関数が存在すること'
);
select is(
  (select prosecdef from pg_proc where proname = 'join_by_invite' and pronamespace = 'public'::regnamespace),
  true,
  'join_by_invite は SECURITY DEFINER であること'
);

-- セットアップ: オーナー・既存viewer・参加者ユーザーとカレンダー
set local role postgres;
insert into auth.users (id) values
  ('55555555-5555-5555-5555-555555555555'), -- owner
  ('66666666-6666-6666-6666-666666666666'), -- 既存viewer
  ('77777777-7777-7777-7777-777777777777'), -- 招待経由の参加者
  ('88888888-8888-8888-8888-888888888888'); -- 期限切れ招待を使う参加者

set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
insert into public.calendars (name) values ('友人グループ') returning id \gset cal2_

set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role)
values (:'cal2_id'::uuid, '66666666-6666-6666-6666-666666666666', 'viewer');

-- owner(editor以上)は招待を発行できる
set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
insert into public.calendar_invites (calendar_id) values (:'cal2_id'::uuid) returning code \gset invite1_

select ok(
  exists(select 1 from public.calendar_invites where code = :'invite1_code' and calendar_id = :'cal2_id'::uuid),
  'owner は招待コードを発行できること'
);

-- viewerは招待を発行できない
set local request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
select throws_ok(
  $$ insert into public.calendar_invites (calendar_id) values (:'cal2_id') $$,
  '42501',
  null,
  'viewerロールのメンバーは招待コードを発行できないこと'
);

-- 招待コードでの参加: 新規ユーザーがviewerとして追加される
set local request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
select role from public.join_by_invite(:'invite1_code') \gset joinresult_

select is(
  :'joinresult_role',
  'viewer',
  '招待コードで参加すると viewer ロールで追加されること'
);
select ok(
  exists(
    select 1 from public.calendar_members
    where calendar_id = :'cal2_id'::uuid
      and user_id = '77777777-7777-7777-7777-777777777777'
      and role = 'viewer'
  ),
  '参加者が calendar_members に登録されること'
);

-- 存在しない招待コードはA0001
select throws_ok(
  $$ select * from public.join_by_invite('this-code-does-not-exist') $$,
  'A0001',
  null,
  '存在しない招待コードはエラーになること'
);

-- 有効期限切れの招待コードはA0002
set local role postgres;
insert into public.calendar_invites (calendar_id, expires_at, created_by)
values (:'cal2_id'::uuid, now() - interval '1 day', '55555555-5555-5555-5555-555555555555')
returning code \gset expired_

set local role authenticated;
set local request.jwt.claim.sub = '88888888-8888-8888-8888-888888888888';
select throws_ok(
  $$ select * from public.join_by_invite(:'expired_code') $$,
  'A0002',
  null,
  '有効期限切れの招待コードはエラーになること'
);

-- 既にメンバーの場合、同じ招待コードを再利用してもエラーにならず冪等であること
set local request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
select lives_ok(
  $$ select * from public.join_by_invite(:'invite1_code') $$,
  '既にメンバーが同じ招待コードを再利用してもエラーにならないこと'
);
select is(
  (
    select count(*) from public.calendar_members
    where calendar_id = :'cal2_id'::uuid
      and user_id = '77777777-7777-7777-7777-777777777777'
  ),
  1::bigint,
  '再参加してもcalendar_membersに重複行が作られないこと'
);

select * from finish();
rollback;
