-- 献立の通知設定: 本人だけが読み書きでき、通知ログは日付×時間帯で重複しないことを検証する

begin;
select plan(11);

select has_table('public', 'meal_notification_settings', 'meal_notification_settings テーブルが存在すること');
select is(
  (select relrowsecurity from pg_class where oid = 'public.meal_notification_settings'::regclass),
  true,
  'meal_notification_settings テーブルで RLS が有効であること'
);
select policies_are(
  'public', 'meal_notification_settings',
  array[
    'meal_notification_settings_insert_own',
    'meal_notification_settings_select_own',
    'meal_notification_settings_update_own'
  ],
  'meal_notification_settings に想定通りのRLSポリシー(本人のみ)が定義されていること'
);

-- テストユーザー2名
insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-0000000000a1', 'meal-a@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'meal-b@example.com', 'authenticated', 'authenticated');

-- 既定値: 朝8:00・昼12:00・夕18:00・間食15:00、マスターはオフ、各時間帯はオン
insert into public.meal_notification_settings (user_id) values ('00000000-0000-0000-0000-0000000000a1');
select is(
  (select enabled from public.meal_notification_settings where user_id = '00000000-0000-0000-0000-0000000000a1'),
  false,
  'マスタースイッチの既定値はオフであること'
);
select is(
  (select array[breakfast_time::text, lunch_time::text, dinner_time::text, snack_time::text]
     from public.meal_notification_settings where user_id = '00000000-0000-0000-0000-0000000000a1'),
  array['08:00:00', '12:00:00', '18:00:00', '15:00:00'],
  '通知時刻の既定値が朝8:00・昼12:00・夕18:00・間食15:00であること'
);
select is(
  (select breakfast_enabled and lunch_enabled and dinner_enabled and snack_enabled
     from public.meal_notification_settings where user_id = '00000000-0000-0000-0000-0000000000a1'),
  true,
  '各時間帯の既定値はオンであること'
);

-- RLS: 本人の行だけ見える/書ける
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.meal_notification_settings),
  0,
  '他のユーザーの設定は読めないこと'
);
select throws_ok(
  $$ insert into public.meal_notification_settings (user_id) values ('00000000-0000-0000-0000-0000000000a1') $$,
  '42501',
  null,
  '他のユーザーの設定は作成できないこと'
);
select lives_ok(
  $$ insert into public.meal_notification_settings (enabled) values (true) $$,
  '自分の設定は作成できること(user_idは既定でauth.uid())'
);

reset role;

-- notification_log: 同じユーザー・日付・時間帯の献立通知は2件入らない
insert into public.notification_log (type, target_user_id, meal_date, meal_slot)
values ('meal_reminder', '00000000-0000-0000-0000-0000000000a1', '2026-10-09', 'breakfast');
select throws_ok(
  $$ insert into public.notification_log (type, target_user_id, meal_date, meal_slot)
     values ('meal_reminder', '00000000-0000-0000-0000-0000000000a1', '2026-10-09', 'breakfast') $$,
  '23505',
  null,
  '同じ日・同じ時間帯の献立通知は重複登録できないこと'
);
select lives_ok(
  $$ insert into public.notification_log (type, target_user_id, meal_date, meal_slot)
     values ('meal_reminder', '00000000-0000-0000-0000-0000000000a1', '2026-10-09', 'lunch') $$,
  '別の時間帯なら同じ日でも登録できること'
);

select * from finish();
rollback;
