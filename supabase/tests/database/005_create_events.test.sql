-- タスク4.1: eventsスキーマと単発予定の登録を検証する

begin;
select plan(19);

-- events テーブルの構造
select has_table('public', 'events', 'events テーブルが存在すること');
select has_column('public', 'events', 'id', 'events.id 列が存在すること');
select has_column('public', 'events', 'calendar_id', 'events.calendar_id 列が存在すること');
select has_column('public', 'events', 'title', 'events.title 列が存在すること');
select has_column('public', 'events', 'start_at', 'events.start_at 列が存在すること');
select has_column('public', 'events', 'end_at', 'events.end_at 列が存在すること');
select has_column('public', 'events', 'reminder_at', 'events.reminder_at 列が存在すること');
select has_column('public', 'events', 'created_by', 'events.created_by 列が存在すること');
select has_column('public', 'events', 'updated_by', 'events.updated_by 列が存在すること');
select col_is_pk('public', 'events', 'id', 'events.id が主キーであること');
select col_is_fk('public', 'events', 'calendar_id', 'events.calendar_id が外部キー(calendars参照)であること');
select is(
  (select relrowsecurity from pg_class where oid = 'public.events'::regclass),
  true,
  'events テーブルで RLS が有効であること'
);
-- ポリシーの網羅的な一覧検証はタスク4.2以降で追加されるためここでは個別に存在確認する
select ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'events' and policyname = 'events_insert_member'
  ),
  'events_insert_member ポリシーが定義されていること'
);
select ok(
  exists(
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'events' and policyname = 'events_select_member'
  ),
  'events_select_member ポリシーが定義されていること'
);

-- 実際の予定登録と閲覧
set local role postgres;
insert into auth.users (id) values
  ('55555555-5555-5555-5555-555555555555'),
  ('66666666-6666-6666-6666-666666666666');

set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';

insert into public.calendars (name) values ('我が家') returning id \gset calendar1_

insert into public.events (calendar_id, title, start_at, end_at)
  values (:'calendar1_id', '誕生日会', '2026-09-01T10:00:00+00', '2026-09-01T12:00:00+00')
  returning id \gset event1_

select ok(
  exists(
    select 1 from public.events
    where id = :'event1_id'::uuid
      and created_by = '55555555-5555-5555-5555-555555555555'
      and updated_by = '55555555-5555-5555-5555-555555555555'
  ),
  '登録した予定に作成者・最終更新者が記録されること'
);

-- RLS: カレンダーメンバーは登録した予定を閲覧できる(招待経由の別メンバーを想定)
insert into public.calendar_members (calendar_id, user_id, role)
  values (:'calendar1_id', '66666666-6666-6666-6666-666666666666', 'viewer');

set local request.jwt.claim.sub = '66666666-6666-6666-6666-666666666666';
select is(
  (select count(*) from public.events where id = :'event1_id'::uuid),
  1::bigint,
  '登録した予定が他のカレンダーメンバーの一覧に反映されること'
);

-- RLS: 非メンバーは予定を閲覧できない
set local role postgres;
insert into auth.users (id) values ('77777777-7777-7777-7777-777777777777');
set local role authenticated;
set local request.jwt.claim.sub = '77777777-7777-7777-7777-777777777777';
select is(
  (select count(*) from public.events where id = :'event1_id'::uuid),
  0::bigint,
  '非メンバーは予定をSELECTできないこと'
);

-- RLS: 非メンバーは予定を登録できない
select throws_ok(
  $$ insert into public.events (calendar_id, title, start_at, end_at)
     values (:'calendar1_id', '不正な予定', now(), now() + interval '1 hour') $$,
  '42501',
  null,
  '非メンバーは予定をINSERTできないこと'
);

-- CHECK制約: 終了日時が開始日時より前の予定は許可しない
set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
select throws_ok(
  $$ insert into public.events (calendar_id, title, start_at, end_at)
     values (:'calendar1_id', '不正な予定', '2026-09-02T10:00:00+00', '2026-09-02T09:00:00+00') $$,
  '23514',
  null,
  '終了日時が開始日時より前の予定はCHECK制約で拒否されること'
);

select * from finish();
rollback;
