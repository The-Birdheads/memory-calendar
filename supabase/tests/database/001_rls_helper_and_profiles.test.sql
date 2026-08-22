-- タスク1.2: is_calendar_member ヘルパー関数と profiles テーブルのRLSを検証する

begin;
select plan(12);

-- is_calendar_member(uuid, uuid) が SECURITY DEFINER の boolean 関数として存在すること
select has_function(
  'public', 'is_calendar_member', array['uuid', 'uuid'],
  'is_calendar_member(uuid, uuid) 関数が存在すること'
);
select function_returns(
  'public', 'is_calendar_member', array['uuid', 'uuid'], 'boolean',
  'is_calendar_member は boolean を返すこと'
);
select is(
  (select prosecdef from pg_proc where proname = 'is_calendar_member' and pronamespace = 'public'::regnamespace),
  true,
  'is_calendar_member は SECURITY DEFINER であること'
);

-- profiles テーブルが auth.users と連携し RLS で保護されていること
select has_table('public', 'profiles', 'profiles テーブルが存在すること');
select has_column('public', 'profiles', 'id', 'profiles.id 列が存在すること');
select col_is_pk('public', 'profiles', 'id', 'profiles.id が主キーであること');
select col_is_fk('public', 'profiles', 'id', 'profiles.id が外部キー(auth.users参照)であること');
select is(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  true,
  'profiles テーブルで RLS が有効であること'
);
select policies_are(
  'public', 'profiles',
  array['profiles_select_authenticated', 'profiles_insert_own', 'profiles_update_own'],
  'profiles に想定通りのRLSポリシーが定義されていること'
);

-- 実際の読み書きがRLS経由で制御されること
set local role postgres;
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

-- auth.users への INSERT で handle_new_user トリガーが profiles 行を自動生成すること
select ok(
  exists(select 1 from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'auth.usersへのINSERTでprofiles行が自動生成されること'
);

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

update public.profiles set display_name = 'user1-updated'
  where id = '11111111-1111-1111-1111-111111111111';
select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'user1-updated',
  '自分自身のprofile行はUPDATEできること'
);

update public.profiles set display_name = 'hacked'
  where id = '22222222-2222-2222-2222-222222222222';
select is(
  (select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  null,
  '他人のprofile行はRLSによりUPDATEできないこと'
);

select * from finish();
rollback;
