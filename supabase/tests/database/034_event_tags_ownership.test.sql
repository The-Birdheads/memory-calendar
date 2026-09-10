-- タスク15.2: 予定へのタグ紐付けが、タグの所有者本人にのみ表示・登録可能であることを検証する

begin;
select plan(6);

-- セットアップ: 同じカレンダー・予定を共有する2ユーザー。それぞれが自分のタグを同じ予定に設定する
set local role postgres;
insert into auth.users (id) values
  ('66666666-7777-8888-9999-aaaaaaaaaaa1'), -- user1
  ('66666666-7777-8888-9999-aaaaaaaaaaa2'); -- user2

set local role authenticated;
set local request.jwt.claim.sub = '66666666-7777-8888-9999-aaaaaaaaaaa1';
insert into public.calendars (name) values ('共有カレンダー') returning id \gset cal_

set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role)
  values (:'cal_id'::uuid, '66666666-7777-8888-9999-aaaaaaaaaaa2', 'viewer');

set local role authenticated;
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'cal_id', '共有予定', '2026-09-22T10:00:00+00', '2026-09-22T11:00:00+00')
  returning id \gset event_

insert into public.tags (level, name, color) values ('major', 'user1のタグ', '#ff0000') returning id \gset tag1_
insert into public.event_tags (event_id, tag_id) values (:'event_id', :'tag1_id');

set local request.jwt.claim.sub = '66666666-7777-8888-9999-aaaaaaaaaaa2';
insert into public.tags (level, name, color) values ('major', 'user2のタグ', '#00ff00') returning id \gset tag2_
insert into public.event_tags (event_id, tag_id) values (:'event_id', :'tag2_id');

-- user1は自分のタグの紐付けのみを閲覧できる
set local request.jwt.claim.sub = '66666666-7777-8888-9999-aaaaaaaaaaa1';
select is(
  (select count(*) from public.event_tags where event_id = :'event_id'::uuid),
  1::bigint,
  'user1には自分のタグの紐付けのみが見えること'
);
select is(
  (select t.name from public.event_tags et join public.tags t on t.id = et.tag_id
     where et.event_id = :'event_id'::uuid),
  'user1のタグ',
  'user1に見える紐付けは自分のタグであること'
);

-- user2は自分のタグの紐付けのみを閲覧できる(user1のタグは一切見えない)
set local request.jwt.claim.sub = '66666666-7777-8888-9999-aaaaaaaaaaa2';
select is(
  (select count(*) from public.event_tags where event_id = :'event_id'::uuid),
  1::bigint,
  'user2には自分のタグの紐付けのみが見えること'
);
select is(
  (select t.name from public.event_tags et join public.tags t on t.id = et.tag_id
     where et.event_id = :'event_id'::uuid),
  'user2のタグ',
  'user2に見える紐付けは自分のタグであり、user1のタグは見えないこと'
);

-- user2はuser1のタグを同じ予定に紐付けることはできない
select throws_ok(
  format(
    $$ insert into public.event_tags (event_id, tag_id) values (%L, %L) $$,
    :'event_id'::uuid, :'tag1_id'::uuid
  ),
  '42501',
  null,
  '他人が所有するタグを予定に紐付けることはできないこと'
);

-- user1が予定に付けたタグの総数(所有者視点)は変わらず1件のまま
set local request.jwt.claim.sub = '66666666-7777-8888-9999-aaaaaaaaaaa1';
select is(
  (select count(*) from public.event_tags where event_id = :'event_id'::uuid),
  1::bigint,
  '他人による紐付け試行の影響を受けず、user1の紐付け件数は1件のままであること'
);

select * from finish();
rollback;
