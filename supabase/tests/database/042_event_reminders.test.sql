-- 予定のリマインド刷新: event_reminders(個人単位・複数件・終日/時刻指定で選択肢が異なる)を検証する

begin;
select plan(21);

select has_table('public', 'event_reminders', 'event_reminders テーブルが存在すること');
select is(
  (select relrowsecurity from pg_class where oid = 'public.event_reminders'::regclass),
  true,
  'event_reminders テーブルで RLS が有効であること'
);
select policies_are(
  'public', 'event_reminders',
  array[
    'event_reminders_delete_own',
    'event_reminders_insert_own',
    'event_reminders_select_own'
  ],
  'event_reminders に想定通りのRLSポリシーが定義されていること'
);

-- compute_event_reminder_at: 終日予定はJST9時、時刻指定は開始時刻からの相対時刻、
-- カスタムも(値, 単位)から計算する相対オフセットであること
select is(
  public.compute_event_reminder_at('on_day', null, null, '2026-09-10T01:00:00+00'::timestamptz),
  '2026-09-10T00:00:00+00'::timestamptz,
  '当日(JST9時)はUTCで9時間前(2026-09-10T01:00 UTC = JST10:00なので9/10のJST9時はUTC9/10T00:00)に計算されること'
);
select is(
  public.compute_event_reminder_at('day_before_1', null, null, '2026-09-10T01:00:00+00'::timestamptz),
  '2026-09-09T00:00:00+00'::timestamptz,
  '1日前(JST9時)が正しく計算されること'
);
select is(
  public.compute_event_reminder_at('day_before_2', null, null, '2026-09-10T01:00:00+00'::timestamptz),
  '2026-09-08T00:00:00+00'::timestamptz,
  '2日前(JST9時)が正しく計算されること'
);
select is(
  public.compute_event_reminder_at('at_start', null, null, '2026-09-10T10:00:00+00'::timestamptz),
  '2026-09-10T10:00:00+00'::timestamptz,
  '開始時は予定のstart_atそのものであること'
);
select is(
  public.compute_event_reminder_at('before_10m', null, null, '2026-09-10T10:00:00+00'::timestamptz),
  '2026-09-10T09:50:00+00'::timestamptz,
  '10分前が正しく計算されること'
);
select is(
  public.compute_event_reminder_at('before_1h', null, null, '2026-09-10T10:00:00+00'::timestamptz),
  '2026-09-10T09:00:00+00'::timestamptz,
  '1時間前が正しく計算されること'
);
select is(
  public.compute_event_reminder_at('custom', 90, 'minute', '2026-09-10T10:00:00+00'::timestamptz),
  '2026-09-10T08:30:00+00'::timestamptz,
  'カスタム(90分前)が正しく計算されること'
);
select is(
  public.compute_event_reminder_at('custom', 2, 'week', '2026-09-10T10:00:00+00'::timestamptz),
  '2026-08-27T10:00:00+00'::timestamptz,
  'カスタム(2週間前)が正しく計算されること'
);

-- セットアップ: owner + memberが所属するカレンダーと予定
set local role postgres;
insert into auth.users (id) values
  ('88888888-8888-9999-aaaa-000000000001'), -- owner
  ('88888888-8888-9999-aaaa-000000000002'); -- 同じカレンダーの別メンバー

set local role authenticated;
set local request.jwt.claim.sub = '88888888-8888-9999-aaaa-000000000001';
insert into public.calendars (name) values ('リマインド設定検証用') returning id \gset cal42_
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'cal42_id', '検証予定', '2026-09-10T10:00:00+00', '2026-09-10T11:00:00+00')
  returning id \gset event42_

set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role)
  values (:'cal42_id'::uuid, '88888888-8888-9999-aaaa-000000000002', 'viewer');
set local role authenticated;
set local request.jwt.claim.sub = '88888888-8888-9999-aaaa-000000000001';

-- ownerが「開始時」「10分前」に加え、カスタムを2件(30分前, 1日前)設定する
-- (insert時にremind_atが自動計算され、customは複数件登録できること)
insert into public.event_reminders (event_id, kind) values (:'event42_id', 'at_start') returning id \gset r42a_
insert into public.event_reminders (event_id, kind) values (:'event42_id', 'before_10m') returning id \gset r42b_
insert into public.event_reminders (event_id, kind, custom_value, custom_unit)
  values (:'event42_id', 'custom', 30, 'minute') returning id \gset r42c_
insert into public.event_reminders (event_id, kind, custom_value, custom_unit)
  values (:'event42_id', 'custom', 1, 'day') returning id \gset r42d_

select is(
  (select remind_at from public.event_reminders where id = :'r42a_id'::uuid),
  '2026-09-10T10:00:00+00'::timestamptz,
  'insert時にremind_atが自動計算されること(開始時)'
);
select is(
  (select remind_at from public.event_reminders where id = :'r42c_id'::uuid),
  '2026-09-10T09:30:00+00'::timestamptz,
  'insert時にremind_atが自動計算されること(カスタム30分前)'
);
select is(
  (select count(*) from public.event_reminders where event_id = :'event42_id'::uuid and kind = 'custom'),
  2::bigint,
  'カスタムは同じユーザーでも複数件登録できること'
);

-- 同じkindを2件目登録しようとすると一意制約違反になる(カスタム以外は1件まで)
select throws_ok(
  format(
    $$ insert into public.event_reminders (event_id, kind) values (%L, 'at_start') $$,
    :'event42_id'::uuid
  ),
  '23505',
  null,
  '同じkindを同じユーザーが2件登録しようとすると一意制約で拒否されること'
);

-- 全く同じ(値, 単位)のカスタムを重複登録しようとすると一意制約違反になる
select throws_ok(
  format(
    $$ insert into public.event_reminders (event_id, kind, custom_value, custom_unit) values (%L, 'custom', 30, 'minute') $$,
    :'event42_id'::uuid
  ),
  '23505',
  null,
  '全く同じ(値,単位)のカスタムを重複登録しようとすると一意制約で拒否されること'
);

-- 予定のstart_atが変わると、カスタム含む全リマインドのremind_atが再計算される
-- (end_at >= start_atの制約があるため、end_at(9/10T11:00)を超えない範囲でずらす)
set local role postgres;
update public.events set start_at = '2026-09-10T10:30:00+00' where id = :'event42_id'::uuid;

select is(
  (select remind_at from public.event_reminders where id = :'r42a_id'::uuid),
  '2026-09-10T10:30:00+00'::timestamptz,
  '予定のstart_at変更後、開始時リマインドのremind_atが再計算されること'
);
select is(
  (select remind_at from public.event_reminders where id = :'r42b_id'::uuid),
  '2026-09-10T10:20:00+00'::timestamptz,
  '予定のstart_at変更後、10分前リマインドのremind_atが再計算されること'
);
select is(
  (select remind_at from public.event_reminders where id = :'r42c_id'::uuid),
  '2026-09-10T10:00:00+00'::timestamptz,
  '予定のstart_at変更後、カスタム(30分前)のremind_atも再計算されること'
);

-- 同じカレンダーのメンバーであっても、他人のevent_remindersは閲覧できない(完全に個人設定)
set local role authenticated;
set local request.jwt.claim.sub = '88888888-8888-9999-aaaa-000000000002';
select is(
  (select count(*) from public.event_reminders where event_id = :'event42_id'::uuid),
  0::bigint,
  '同じカレンダーのメンバーであっても他人のevent_remindersは閲覧できないこと(自分の行のみ)'
);

-- 予定を削除すると連鎖削除される
set local request.jwt.claim.sub = '88888888-8888-9999-aaaa-000000000001';
delete from public.events where id = :'event42_id'::uuid;

set local role postgres;
select is(
  (select count(*) from public.event_reminders where event_id = :'event42_id'::uuid),
  0::bigint,
  '予定を削除するとevent_remindersが連鎖削除されること'
);

select * from finish();
rollback;
