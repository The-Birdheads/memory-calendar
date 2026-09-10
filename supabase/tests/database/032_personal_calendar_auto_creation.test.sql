-- タスク14.1: サインアップトリガー拡張と個人用カレンダーの一意性保証

begin;
select plan(10);

-- calendars(created_by) に kind='personal' の部分ユニークインデックスが存在すること
select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'calendars'
      and indexdef ilike '%unique%'
      and indexdef ilike '%kind = ''personal''%'
  ),
  'calendars(created_by) に kind=personal の部分ユニークインデックスが存在すること'
);

-- calendars のRLSポリシー構成(名前)は変わらないこと
select policies_are(
  'public', 'calendars',
  array['calendars_insert_own', 'calendars_select_member', 'calendars_update_owner'],
  'calendars のRLSポリシー構成が変わらないこと'
);

-- セットアップ: 新規サインアップユーザー
set local role postgres;
insert into auth.users (id) values ('bbbbbbbb-1111-1111-1111-111111111111');

-- サインアップ時に個人用カレンダーが自動生成されること
select ok(
  exists (
    select 1 from public.calendars
    where created_by = 'bbbbbbbb-1111-1111-1111-111111111111'
      and kind = 'personal'
  ),
  'サインアップ時に個人用カレンダーが自動生成されること'
);

select is(
  (select name from public.calendars
    where created_by = 'bbbbbbbb-1111-1111-1111-111111111111' and kind = 'personal'),
  'Myカレンダー',
  '個人用カレンダーの名称が「Myカレンダー」であること'
);

-- 本人が個人用カレンダーのオーナーとしてcalendar_membersに登録されること
select ok(
  exists (
    select 1 from public.calendar_members cm
    join public.calendars c on c.id = cm.calendar_id
    where c.created_by = 'bbbbbbbb-1111-1111-1111-111111111111'
      and c.kind = 'personal'
      and cm.user_id = 'bbbbbbbb-1111-1111-1111-111111111111'
      and cm.role = 'owner'
  ),
  '本人が個人用カレンダーのオーナーとしてcalendar_membersに登録されること'
);

-- 一意性: 同一ユーザーの2件目のpersonalカレンダーはDBレベルで拒否されること
select throws_ok(
  $$ insert into public.calendars (name, kind, created_by)
     values ('2つ目', 'personal', 'bbbbbbbb-1111-1111-1111-111111111111') $$,
  '23505',
  null,
  '1ユーザーにつきkind=personalのカレンダーは1件のみ許可されること'
);

-- RLS: クライアントは直接kind=personalのカレンダーを作成できないこと
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-1111-1111-1111-111111111111';
select throws_ok(
  $$ insert into public.calendars (name, kind) values ('偽装個人用', 'personal') $$,
  '42501',
  null,
  'クライアントは直接kind=personalのカレンダーを作成できないこと'
);

-- 回帰確認: クライアントは引き続きkind=groupのカレンダーを作成できること
insert into public.calendars (name, kind) values ('グループカレンダー', 'group') returning id \gset grp_
select ok(
  exists (select 1 from public.calendars where id = :'grp_id'::uuid and kind = 'group'),
  'クライアントは引き続きkind=groupのカレンダーを作成できること'
);

-- 個人用カレンダーには招待を発行できないこと(要件2.9)
select throws_ok(
  format(
    $$ insert into public.calendar_invites (calendar_id) values (%L) $$,
    (select id from public.calendars
      where created_by = 'bbbbbbbb-1111-1111-1111-111111111111' and kind = 'personal')
  ),
  '42501',
  null,
  '個人用カレンダーには招待を発行できないこと'
);

-- 回帰確認: グループカレンダーには引き続き招待を発行できること
select lives_ok(
  format($$ insert into public.calendar_invites (calendar_id) values (%L) $$, :'grp_id'::uuid),
  'グループカレンダーには引き続き招待を発行できること'
);

select * from finish();
rollback;
