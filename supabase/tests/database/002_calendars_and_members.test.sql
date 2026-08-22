-- タスク3.1: calendars/calendar_members スキーマとカレンダー作成を検証する

begin;
select plan(20);

-- calendars テーブルの構造
select has_table('public', 'calendars', 'calendars テーブルが存在すること');
select has_column('public', 'calendars', 'id', 'calendars.id 列が存在すること');
select has_column('public', 'calendars', 'name', 'calendars.name 列が存在すること');
select has_column('public', 'calendars', 'created_by', 'calendars.created_by 列が存在すること');
select has_column('public', 'calendars', 'created_at', 'calendars.created_at 列が存在すること');
select col_is_pk('public', 'calendars', 'id', 'calendars.id が主キーであること');
select col_is_fk(
  'public', 'calendars', 'created_by',
  'calendars.created_by が外部キー(profiles参照)であること'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.calendars'::regclass),
  true,
  'calendars テーブルで RLS が有効であること'
);
select policies_are(
  'public', 'calendars',
  array['calendars_insert_own', 'calendars_select_member'],
  'calendars に想定通りのRLSポリシーが定義されていること'
);

-- calendar_members テーブルの構造
select has_table('public', 'calendar_members', 'calendar_members テーブルが存在すること');
select has_column('public', 'calendar_members', 'role', 'calendar_members.role 列が存在すること');
select has_column('public', 'calendar_members', 'joined_at', 'calendar_members.joined_at 列が存在すること');
select col_is_pk(
  'public', 'calendar_members', array['calendar_id', 'user_id'],
  'calendar_members が (calendar_id, user_id) の複合主キーであること'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.calendar_members'::regclass),
  true,
  'calendar_members テーブルで RLS が有効であること'
);
select policies_are(
  'public', 'calendar_members',
  array['calendar_members_select_member'],
  'calendar_members に想定通りのRLSポリシーが定義されていること'
);

-- 実際のカレンダー作成でオーナーとして自身が登録されること
set local role postgres;
insert into auth.users (id) values
  ('33333333-3333-3333-3333-333333333333'),
  ('44444444-4444-4444-4444-444444444444');

set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';

insert into public.calendars (name) values ('我が家') returning id \gset calendar1_

select ok(
  exists(
    select 1 from public.calendar_members
    where calendar_id = :'calendar1_id'::uuid
      and user_id = '33333333-3333-3333-3333-333333333333'
      and role = 'owner'
  ),
  'カレンダー作成時に作成者がownerとしてcalendar_membersに自動登録されること'
);

-- RLS: 非メンバーはカレンダーを閲覧できない
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select is(
  (select count(*) from public.calendars where id = :'calendar1_id'::uuid),
  0::bigint,
  '非メンバーはカレンダーをSELECTできないこと'
);

-- RLS: メンバー本人はカレンダーを閲覧できる
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select is(
  (select count(*) from public.calendars where id = :'calendar1_id'::uuid),
  1::bigint,
  'メンバー本人はカレンダーをSELECTできること'
);

-- RLS: calendar_membersへの直接INSERTは許可されない(トリガー経由のみ許可)
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select throws_ok(
  $$ insert into public.calendar_members (calendar_id, user_id, role)
     values (:'calendar1_id', '44444444-4444-4444-4444-444444444444', 'viewer') $$,
  '42501',
  null,
  'calendar_members への直接INSERTはRLSで拒否されること'
);

-- CHECK制約: role は owner/editor/viewer 以外を許可しない
set local role postgres;
select throws_ok(
  $$ insert into public.calendar_members (calendar_id, user_id, role)
     values (:'calendar1_id', '44444444-4444-4444-4444-444444444444', 'admin') $$,
  '23514',
  null,
  'role は owner/editor/viewer 以外を許可しないこと'
);

select * from finish();
rollback;
