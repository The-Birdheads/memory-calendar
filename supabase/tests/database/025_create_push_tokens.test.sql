-- タスク11.1: push_tokensの登録とログアウト時の無効化を検証する

begin;
select plan(12);

select has_table('public', 'push_tokens', 'push_tokens テーブルが存在すること');
select has_column('public', 'push_tokens', 'user_id', 'push_tokens.user_id 列が存在すること');
select has_column('public', 'push_tokens', 'expo_push_token', 'push_tokens.expo_push_token 列が存在すること');
select col_is_unique(
  'public', 'push_tokens', 'expo_push_token',
  'push_tokens.expo_push_token が一意であること'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.push_tokens'::regclass),
  true,
  'push_tokens テーブルで RLS が有効であること'
);
select policies_are(
  'public', 'push_tokens',
  array['push_tokens_delete_own', 'push_tokens_insert_own', 'push_tokens_select_own', 'push_tokens_update_own'],
  'push_tokens に想定通りのRLSポリシーが定義されていること'
);

-- セットアップ
set local role postgres;
insert into auth.users (id) values
  ('44444444-4444-5555-6666-777777777771'), -- user1
  ('44444444-4444-5555-6666-777777777772'); -- user2

-- 権限許可後にトークンがpush_tokensへ保存される
set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-5555-6666-777777777771';
insert into public.push_tokens (expo_push_token, device_info)
  values ('ExponentPushToken[user1]', 'iPhone 15');

select is(
  (select count(*) from public.push_tokens where user_id = '44444444-4444-5555-6666-777777777771'),
  1::bigint,
  '権限許可後にトークンがpush_tokensへ保存されること'
);

-- 他人のトークンは閲覧できない
set local request.jwt.claim.sub = '44444444-4444-5555-6666-777777777772';
select is(
  (select count(*) from public.push_tokens where user_id = '44444444-4444-5555-6666-777777777771'),
  0::bigint,
  '他のユーザーのトークンは閲覧できないこと'
);

-- 他人のトークンは削除できない
delete from public.push_tokens where user_id = '44444444-4444-5555-6666-777777777771';
set local role postgres;
select is(
  (select count(*) from public.push_tokens where user_id = '44444444-4444-5555-6666-777777777771'),
  1::bigint,
  '他のユーザーがトークンを削除しようとしても削除されないこと'
);

-- ログアウト時の無効化: 本人はトークンを削除できる
set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-5555-6666-777777777771';
delete from public.push_tokens where expo_push_token = 'ExponentPushToken[user1]';

select is(
  (select count(*) from public.push_tokens where user_id = '44444444-4444-5555-6666-777777777771'),
  0::bigint,
  'ログアウト時に本人のトークンを無効化(削除)できること'
);

-- 同一トークンでの再登録(upsert相当)は一意制約により重複しない
insert into public.push_tokens (expo_push_token, device_info) values ('ExponentPushToken[user1]', 'iPhone 15');
insert into public.push_tokens (expo_push_token, device_info)
  values ('ExponentPushToken[user1]', 'iPhone 15 Pro')
  on conflict (expo_push_token) do update set device_info = excluded.device_info;

select is(
  (select count(*) from public.push_tokens where expo_push_token = 'ExponentPushToken[user1]'),
  1::bigint,
  '同一トークンの再登録は一意制約により重複しないこと'
);
select is(
  (select device_info from public.push_tokens where expo_push_token = 'ExponentPushToken[user1]'),
  'iPhone 15 Pro',
  '再登録時にdevice_infoが更新されること'
);

select * from finish();
rollback;
