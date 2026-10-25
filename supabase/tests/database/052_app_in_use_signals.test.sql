-- _app_in_use の判定を検証する。利用記録(app_usage)が無くても、
-- Memory Calendar の実データ(Pushトークン)があれば使用中とみなし、アカウントを残すことを確認する。

begin;
select plan(5);

set local role postgres;
insert into auth.users (id) values
  ('52000000-0000-0000-0000-000000000001'), -- U1: Habitas を使い、Memory Calendar はログインしただけ(Pushトークンのみ)
  ('52000000-0000-0000-0000-000000000002'); -- U2: Habitas だけ

select is(
  public._app_in_use('52000000-0000-0000-0000-000000000001', 'memory_calendar'),
  false,
  'U1: Pushトークン登録前は、Memory Calendar を使っていないとみなす'
);

insert into public.push_tokens (user_id, expo_push_token)
values ('52000000-0000-0000-0000-000000000001', 'ExponentPushToken[test-052]');

select is(
  public._app_in_use('52000000-0000-0000-0000-000000000001', 'memory_calendar'),
  true,
  'U1: Pushトークンがあれば、利用記録が無くても Memory Calendar を使っているとみなす'
);

-- U1: Habitas を削除してもアカウントは残る
set local role authenticated;
set local request.jwt.claim.sub = '52000000-0000-0000-0000-000000000001';
select public.register_app_use('habitas');
select is(public.delete_app_data('habitas'), false, 'U1: Habitas のデータ削除はアカウントを残す(false)');

set local role postgres;
select is(
  (select count(*) from auth.users where id = '52000000-0000-0000-0000-000000000001')::int,
  1,
  'U1: アカウントが残ること'
);

-- U2: Memory Calendar の実データが無ければ、アカウントごと削除される
set local role authenticated;
set local request.jwt.claim.sub = '52000000-0000-0000-0000-000000000002';
select public.register_app_use('habitas');
select is(public.delete_app_data('habitas'), true, 'U2: Habitas だけの利用者はアカウントごと削除される(true)');

select * from finish();
rollback;
