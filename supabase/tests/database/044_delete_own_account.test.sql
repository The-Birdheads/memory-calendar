-- アカウント削除(delete_own_account RPC)を検証する。
-- 個人用カレンダーとその配下データ・ToDo/タグは削除され、参加中の共有カレンダーは
-- leave_or_delete_calendar と同じ規則で後始末され、共有カレンダーに残るコンテンツ
-- (予定・コメント・写真)は削除されず作成者/更新者列がNULLになることを確認する。

begin;
select plan(16);

select has_function(
  'public', 'delete_own_account', array[]::text[],
  'delete_own_account() 関数が存在すること'
);
select is(
  (select prosecdef from pg_proc where proname = 'delete_own_account' and pronamespace = 'public'::regnamespace),
  true,
  'delete_own_account は SECURITY DEFINER であること'
);

-- セットアップ: 退会するユーザーA、共有カレンダーの他メンバーB
set local role postgres;
insert into auth.users (id) values
  ('44444444-4444-4444-4444-444444444444'), -- 退会するユーザー(個人用カレンダーが自動作成される)
  ('55555555-5555-5555-5555-555555555555'); -- 共有カレンダーに残るメンバー

-- Aの個人用カレンダーに、ToDo・タグ・予定を作る
set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select id from public.calendars
where created_by = '44444444-4444-4444-4444-444444444444' and kind = 'personal' \gset personal_

insert into public.events (calendar_id, title, start_at, end_at)
values (:'personal_id'::uuid, '個人の予定', now(), now() + interval '1 hour')
returning id \gset personal_event_

insert into public.todos (event_id, title) values (:'personal_event_id'::uuid, '個人のToDo') returning id \gset todo_
insert into public.tags (level, name, color) values ('major', '旅行', '#e53935') returning id \gset tag_

-- Aが単独メンバーのグループカレンダー(自分のみなので削除される)
insert into public.calendars (name) values ('単独グループ') returning id \gset solo_

-- Aが作成し、Bも参加する共有グループカレンダー(Aが退会後も残る)
insert into public.calendars (name) values ('共有グループ') returning id \gset shared_
insert into public.events (calendar_id, title, start_at, end_at)
values (:'shared_id'::uuid, '共有の予定', now(), now() + interval '1 hour')
returning id \gset shared_event_
insert into public.event_comments (event_id, body) values (:'shared_event_id'::uuid, 'よろしくね') returning id \gset comment_
insert into public.event_photos (event_id, storage_path) values (:'shared_event_id'::uuid, :'shared_event_id' || '/photo.jpg') returning id \gset photo_

set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role)
values (:'shared_id'::uuid, '55555555-5555-5555-5555-555555555555', 'viewer');

-- 実行: Aが自分のアカウントを削除する
set local role authenticated;
set local request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select public.delete_own_account();

-- 検証(RLSを回避するためpostgresロールで確認する)
set local role postgres;

select ok(
  not exists(select 1 from auth.users where id = '44444444-4444-4444-4444-444444444444'),
  'auth.users からAが削除されること'
);
select ok(
  not exists(select 1 from public.profiles where id = '44444444-4444-4444-4444-444444444444'),
  'profiles からAが削除されること(auth.usersからのcascade)'
);
select ok(
  not exists(select 1 from public.calendars where id = :'personal_id'::uuid),
  'Aの個人用カレンダーが削除されること'
);
select ok(
  not exists(select 1 from public.events where id = :'personal_event_id'::uuid),
  '個人用カレンダー配下の予定もcascadeで削除されること'
);
select ok(
  not exists(select 1 from public.todos where id = :'todo_id'::uuid),
  'AのToDoが削除されること'
);
select ok(
  not exists(select 1 from public.tags where id = :'tag_id'::uuid),
  'Aのタグが削除されること'
);
select ok(
  not exists(select 1 from public.calendars where id = :'solo_id'::uuid),
  'Aが単独メンバーだったグループカレンダーが削除されること'
);

select ok(
  exists(select 1 from public.calendars where id = :'shared_id'::uuid),
  '他にメンバーがいる共有カレンダーは削除されないこと'
);
select ok(
  exists(
    select 1 from public.calendar_members
    where calendar_id = :'shared_id'::uuid and user_id = '55555555-5555-5555-5555-555555555555'
  ),
  '残ったメンバーBのcalendar_membersは維持されること'
);
select ok(
  exists(select 1 from public.events where id = :'shared_event_id'::uuid),
  '共有カレンダー内の、Aが作成した予定は削除されないこと'
);
select is(
  (select created_by from public.events where id = :'shared_event_id'::uuid),
  null,
  '共有カレンダー内の予定のcreated_byはNULLになること'
);
select is(
  (select updated_by from public.events where id = :'shared_event_id'::uuid),
  null,
  '共有カレンダー内の予定のupdated_byはNULLになること'
);
select ok(
  exists(select 1 from public.event_comments where id = :'comment_id'::uuid),
  'Aが投稿したコメントは削除されないこと'
);
select is(
  (select user_id from public.event_comments where id = :'comment_id'::uuid),
  null,
  'コメントのuser_idはNULLになること'
);
select ok(
  exists(select 1 from public.event_photos where id = :'photo_id'::uuid),
  'Aがアップロードした写真は削除されないこと'
);
select is(
  (select uploaded_by from public.event_photos where id = :'photo_id'::uuid),
  null,
  '写真のuploaded_byはNULLになること'
);

select * from finish();
rollback;
