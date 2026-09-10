-- タスク4.2: 予定の編集・削除(RLSと最終更新者の自動記録)を検証する

begin;
select plan(9);

select has_function(
  'public', 'handle_event_update',
  'handle_event_update() 関数が存在すること'
);
select policies_are(
  'public', 'events',
  array['events_delete_member', 'events_insert_member', 'events_select_member', 'events_update_member'],
  'events に想定通りのRLSポリシーが定義されていること(編集・削除を含む)'
);

-- セットアップ: owner(作成者)とviewer(別メンバー)が所属するカレンダー
set local role postgres;
insert into auth.users (id) values
  ('88888888-8888-8888-8888-888888888881'),
  ('88888888-8888-8888-8888-888888888882'),
  ('88888888-8888-8888-8888-888888888883');

set local role authenticated;
set local request.jwt.claim.sub = '88888888-8888-8888-8888-888888888881';
insert into public.calendars (name) values ('編集削除検証用') returning id \gset cal4_

set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role) values
  (:'cal4_id'::uuid, '88888888-8888-8888-8888-888888888882', 'viewer');

set local role authenticated;
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'cal4_id', '会議', '2026-09-05T10:00:00+00', '2026-09-05T11:00:00+00')
  returning id \gset event4_

-- 他のカレンダーメンバーが編集すると、最終更新者が操作者自身に更新される
set local request.jwt.claim.sub = '88888888-8888-8888-8888-888888888882';
update public.events set title = '会議(変更後)' where id = :'event4_id'::uuid;

select is(
  (select title from public.events where id = :'event4_id'::uuid),
  '会議(変更後)',
  'カレンダーメンバーは予定を編集できること'
);
select is(
  (select updated_by from public.events where id = :'event4_id'::uuid),
  '88888888-8888-8888-8888-888888888882'::uuid,
  '編集操作を行ったユーザーがupdated_byに記録されること'
);
select is(
  (select created_by from public.events where id = :'event4_id'::uuid),
  '88888888-8888-8888-8888-888888888881'::uuid,
  'created_byは編集後も不変であること'
);

-- CHECK制約: 更新時も終了日時が開始日時より前の値は許可しない
select throws_ok(
  format(
    $$ update public.events set end_at = '2026-09-05T09:00:00+00' where id = %L $$,
    :'event4_id'
  ),
  '23514',
  null,
  '更新時に終了日時が開始日時より前になる変更はCHECK制約で拒否されること'
);

-- 非メンバーは予定を編集・削除できない
set local role postgres;
insert into auth.users (id) values ('88888888-8888-8888-8888-888888888884');
set local role authenticated;
set local request.jwt.claim.sub = '88888888-8888-8888-8888-888888888884';

update public.events set title = '不正な変更' where id = :'event4_id'::uuid;
delete from public.events where id = :'event4_id'::uuid;

-- 非メンバーの操作結果は、その予定を閲覧できるメンバーとして確認する
-- (非メンバーは events_select_member で SELECT もできないため、非メンバーの
--  ままだと下の副問い合わせが常にNULL/0件になり検証にならない)
set local request.jwt.claim.sub = '88888888-8888-8888-8888-888888888881';
select is(
  (select title from public.events where id = :'event4_id'::uuid),
  '会議(変更後)',
  '非メンバーが編集を試みても変更されないこと'
);
select ok(
  exists(select 1 from public.events where id = :'event4_id'::uuid),
  '非メンバーが削除を試みても予定は削除されないこと'
);

-- カレンダーメンバーによる削除は成功し、全メンバーの表示から消える
set local request.jwt.claim.sub = '88888888-8888-8888-8888-888888888881';
delete from public.events where id = :'event4_id'::uuid;

select ok(
  not exists(select 1 from public.events where id = :'event4_id'::uuid),
  'カレンダーメンバーによる削除で予定が全メンバーの表示から消えること'
);

select * from finish();
rollback;
