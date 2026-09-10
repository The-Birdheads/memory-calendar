-- タスク: カレンダー種別(個人用/グループ用)と、オーナーによる名称・種別の更新を検証する

begin;
select plan(6);

select has_column('public', 'calendars', 'kind', 'calendars.kind 列が存在すること');
select col_has_default('public', 'calendars', 'kind', 'calendars.kind に既定値が設定されていること');
select policies_are(
  'public', 'calendars',
  array['calendars_insert_own', 'calendars_select_member', 'calendars_update_owner'],
  'calendars に更新ポリシーを含む想定通りのRLSポリシーが定義されていること'
);

-- セットアップ: owner + viewerが所属するカレンダー
-- (kind='personal'はタスク14以降サインアップトリガー経由でのみ作成可能なため、
--  クライアントからの直接作成を伴うこのテストのセットアップはkind='group'を用いる)
set local role postgres;
insert into auth.users (id) values
  ('aaaaaaaa-1111-1111-1111-111111111111'), -- owner
  ('aaaaaaaa-2222-2222-2222-222222222222'); -- viewer

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-1111-1111-1111-111111111111';
insert into public.calendars (name, kind) values ('グループカレンダー', 'group') returning id \gset cal11_

-- CHECK制約: kind は personal/group 以外を許可しない
-- (タスク14以降、RLSのWITH CHECK句がkind='group'以外を先に拒否してしまうため、
--  RLSを経由しないpostgresロールでCHECK制約単体を検証する。created_byはNOT NULLのため明示的に指定する)
set local role postgres;
select throws_ok(
  $$ insert into public.calendars (name, kind, created_by)
     values ('不正な種別', 'shared', 'aaaaaaaa-1111-1111-1111-111111111111') $$,
  '23514',
  null,
  'calendars.kind に personal/group 以外の値は挿入できないこと'
);

insert into public.calendar_members (calendar_id, user_id, role)
  values (:'cal11_id'::uuid, 'aaaaaaaa-2222-2222-2222-222222222222', 'viewer');

-- オーナーはカレンダー名を変更できる
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-1111-1111-1111-111111111111';
update public.calendars set name = '改名後のグループカレンダー' where id = :'cal11_id'::uuid;
select is(
  (select name from public.calendars where id = :'cal11_id'::uuid),
  '改名後のグループカレンダー',
  'オーナーはカレンダー名を変更できること'
);

-- オーナー以外(viewer)はカレンダー名を変更できない
set local request.jwt.claim.sub = 'aaaaaaaa-2222-2222-2222-222222222222';
update public.calendars set name = 'viewerによる改名' where id = :'cal11_id'::uuid;
select is(
  (select name from public.calendars where id = :'cal11_id'::uuid),
  '改名後のグループカレンダー',
  'オーナー以外はカレンダー名を変更できないこと'
);

select * from finish();
rollback;
