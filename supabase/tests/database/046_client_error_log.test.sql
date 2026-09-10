-- client_error_log: アプリ側で捕捉したエラーの記録先を検証する。
-- 認証済みユーザーは自分のエラーだけINSERTでき、閲覧・改変はできないこと。

begin;
select plan(7);

select has_table('public', 'client_error_log', 'client_error_log テーブルが存在すること');
select has_column('public', 'client_error_log', 'message', 'message 列が存在すること');
select is(
  (select relrowsecurity from pg_class where oid = 'public.client_error_log'::regclass),
  true,
  'client_error_log で RLS が有効であること'
);
select policies_are(
  'public', 'client_error_log',
  array['client_error_log_insert_own'],
  'INSERTポリシーのみが定義され、SELECT/UPDATE/DELETEはできないこと'
);

set local role postgres;
insert into auth.users (id) values
  ('e1e1e1e1-0000-0000-0000-000000000001'),
  ('e1e1e1e1-0000-0000-0000-000000000002');

set local role authenticated;
set local request.jwt.claim.sub = 'e1e1e1e1-0000-0000-0000-000000000001';

-- 自分のエラーは記録できる(user_id は default auth.uid() で自動設定)
select lives_ok(
  $$ insert into public.client_error_log (message, stack, context, platform, app_version)
     values ('boom', 'at foo', 'calendar', 'ios', '1.0.0') $$,
  '認証済みユーザーは自分のエラーを記録できること'
);

-- 他人のuser_idを詐称したINSERTはRLSで拒否される
select throws_ok(
  $$ insert into public.client_error_log (user_id, message)
     values ('e1e1e1e1-0000-0000-0000-000000000002', 'spoofed') $$,
  '42501',
  null,
  '他ユーザーのuser_idを指定したINSERTはRLSで拒否されること'
);

-- SELECTポリシーが無いため、記録した本人でも読み出せない
select is(
  (select count(*) from public.client_error_log),
  0::bigint,
  'SELECTポリシーが無く、クライアントからは1件も読み出せないこと'
);

select * from finish();
rollback;
