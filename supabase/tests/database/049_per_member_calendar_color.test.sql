-- カレンダーの色はメンバーごと: 変更は本人にだけ反映され、作成時の色(calendars.color)は変わらない

begin;
select plan(8);

select has_table('public', 'calendar_member_colors', 'calendar_member_colors テーブルが存在すること');
select policies_are(
  'public', 'calendar_member_colors',
  array['calendar_member_colors_select_own'],
  'calendar_member_colors に本人のみ閲覧可のRLSポリシーだけがあること(書き込みはRPC経由のみ)'
);

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-0000000000a2', 'color-a@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 'color-b@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c2', 'color-c@example.com', 'authenticated', 'authenticated');

-- Aが作成した共有カレンダー(作成時の色は青)にBも参加している
insert into public.calendars (id, name, kind, color, created_by)
values ('00000000-0000-0000-0000-0000000000d2', '色テスト', 'group', '#2f6fed', '00000000-0000-0000-0000-0000000000a2');
insert into public.calendar_members (calendar_id, user_id, role)
values ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b2', 'editor');

set local role authenticated;

-- A が赤に変更
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select is(
  (select color from public.update_calendar_color('00000000-0000-0000-0000-0000000000d2', '#e53935')),
  '#e53935',
  '色を変更すると、変更後の色のカレンダーが返ること'
);

-- B(オーナーではないメンバー)が緑に変更できる
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select lives_ok(
  $$ select public.update_calendar_color('00000000-0000-0000-0000-0000000000d2', '#43a047') $$,
  'オーナーではないメンバーも色を変更できること'
);

-- それぞれ自分の色だけが見える
select is(
  (select array_agg(color) from public.calendar_member_colors),
  array['#43a047'],
  'Bには自分の色だけが見えること'
);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select is(
  (select array_agg(color) from public.calendar_member_colors),
  array['#e53935'],
  'Bの変更はAの色に影響しないこと(Aには自分の赤だけが見える)'
);
select is(
  (select color from public.calendars where id = '00000000-0000-0000-0000-0000000000d2'),
  '#2f6fed',
  '作成時の色(calendars.color)は変更されないこと'
);

-- メンバーではないCは変更できない
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select throws_ok(
  $$ select public.update_calendar_color('00000000-0000-0000-0000-0000000000d2', '#000000') $$,
  '42501',
  null,
  'メンバーではないユーザーは色を変更できないこと'
);

select * from finish();
rollback;
