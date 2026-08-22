-- タスク4.6: 予定のリマインダー対象者(event_reminder_targets)を検証する

begin;
select plan(13);

select has_function(
  'public', 'is_event_calendar_member', array['uuid', 'uuid'],
  'is_event_calendar_member(uuid, uuid) 関数が存在すること'
);
select function_returns(
  'public', 'is_event_calendar_member', array['uuid', 'uuid'], 'boolean',
  'is_event_calendar_member は boolean を返すこと'
);
select has_table('public', 'event_reminder_targets', 'event_reminder_targets テーブルが存在すること');
select col_is_pk(
  'public', 'event_reminder_targets', array['event_id', 'user_id'],
  'event_reminder_targets が (event_id, user_id) の複合主キーであること'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.event_reminder_targets'::regclass),
  true,
  'event_reminder_targets テーブルで RLS が有効であること'
);
select policies_are(
  'public', 'event_reminder_targets',
  array[
    'event_reminder_targets_delete_member',
    'event_reminder_targets_insert_member',
    'event_reminder_targets_select_member'
  ],
  'event_reminder_targets に想定通りのRLSポリシーが定義されていること'
);

-- セットアップ: owner + viewer(対象者)が所属するカレンダーと予定
set local role postgres;
insert into auth.users (id) values
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1'), -- owner
  ('cccccccc-cccc-cccc-cccc-ccccccccccc2'), -- viewer(リマインド対象)
  ('cccccccc-cccc-cccc-cccc-ccccccccccc3'); -- 非メンバー

set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-cccc-cccc-cccc-ccccccccccc1';
insert into public.calendars (name) values ('リマインド対象検証用') returning id \gset cal7_

set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role)
  values (:'cal7_id'::uuid, 'cccccccc-cccc-cccc-cccc-ccccccccccc2', 'viewer');

set local role authenticated;
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'cal7_id', 'リマインド予定', '2026-09-10T10:00:00+00', '2026-09-10T11:00:00+00')
  returning id \gset event7_

-- オーナーがviewerを対象者として設定する(EventService.setReminderTargetsのINSERT相当)
insert into public.event_reminder_targets (event_id, user_id)
  values (:'event7_id', 'cccccccc-cccc-cccc-cccc-ccccccccccc2');

select is(
  (select count(*) from public.event_reminder_targets where event_id = :'event7_id'::uuid),
  1::bigint,
  '対象者(特定メンバー)がevent_reminder_targetsに保存されること'
);

-- 対象に指定されたカレンダーメンバー(viewer)は行を閲覧できる
set local request.jwt.claim.sub = 'cccccccc-cccc-cccc-cccc-ccccccccccc2';
select is(
  (select count(*) from public.event_reminder_targets where event_id = :'event7_id'::uuid),
  1::bigint,
  'カレンダーメンバーはevent_reminder_targetsを閲覧できること'
);

-- 非メンバーは閲覧・登録できない
set local request.jwt.claim.sub = 'cccccccc-cccc-cccc-cccc-ccccccccccc3';
select is(
  (select count(*) from public.event_reminder_targets where event_id = :'event7_id'::uuid),
  0::bigint,
  '非メンバーはevent_reminder_targetsを閲覧できないこと'
);
select throws_ok(
  $$ insert into public.event_reminder_targets (event_id, user_id)
     values (:'event7_id', 'cccccccc-cccc-cccc-cccc-ccccccccccc3') $$,
  '42501',
  null,
  '非メンバーはevent_reminder_targetsに登録できないこと'
);

-- オーナーが対象者を「すべてのメンバー」に戻す(既存行を削除して0件=全メンバーの意)
set local request.jwt.claim.sub = 'cccccccc-cccc-cccc-cccc-ccccccccccc1';
delete from public.event_reminder_targets where event_id = :'event7_id'::uuid;

select is(
  (select count(*) from public.event_reminder_targets where event_id = :'event7_id'::uuid),
  0::bigint,
  '対象者を未設定に戻すと行が0件になり、全メンバーが対象とみなされること'
);

-- 予定を削除するとevent_reminder_targetsも連鎖削除される
insert into public.event_reminder_targets (event_id, user_id)
  values (:'event7_id', 'cccccccc-cccc-cccc-cccc-ccccccccccc2');
select is(
  (select count(*) from public.event_reminder_targets where event_id = :'event7_id'::uuid),
  1::bigint,
  '前提: 削除前にevent_reminder_targetsが1件存在すること'
);

delete from public.events where id = :'event7_id'::uuid;

select is(
  (select count(*) from public.event_reminder_targets where event_id = :'event7_id'::uuid),
  0::bigint,
  '予定を削除するとevent_reminder_targetsが連鎖削除されること'
);

select * from finish();
rollback;
