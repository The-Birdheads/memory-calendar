-- タスク9.3: ToDoの達成状況変更・編集・削除を検証する

begin;
select plan(9);

select policies_are(
  'public', 'todos',
  array['todos_delete_member', 'todos_insert_member', 'todos_select_member', 'todos_update_member'],
  'todos に更新・削除ポリシーを含む想定通りのRLSポリシーが定義されていること'
);

-- セットアップ: owner + viewerが所属するカレンダーと予定・ToDo
set local role postgres;
insert into auth.users (id) values
  ('88888888-9999-0000-1111-222222222221'), -- owner
  ('88888888-9999-0000-1111-222222222222'); -- viewer

set local role authenticated;
set local request.jwt.claim.sub = '88888888-9999-0000-1111-222222222221';
insert into public.calendars (name) values ('ToDo編集検証用') returning id \gset cal18_

set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role)
  values (:'cal18_id'::uuid, '88888888-9999-0000-1111-222222222222', 'viewer');

set local role authenticated;
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'cal18_id', 'ToDo編集検証予定', '2026-09-19T10:00:00+00', '2026-09-19T11:00:00+00')
  returning id \gset event18_
insert into public.todos (event_id, title) values (:'event18_id', '飲み物を買う') returning id \gset todo18_

-- 別のカレンダーメンバー(viewer)が完了状態にする(completed_atも更新)
set local request.jwt.claim.sub = '88888888-9999-0000-1111-222222222222';
update public.todos set is_done = true, completed_at = now() where id = :'todo18_id'::uuid;

select is(
  (select is_done from public.todos where id = :'todo18_id'::uuid),
  true,
  'チェック操作で達成状況(is_done)が更新されること'
);
select ok(
  (select completed_at from public.todos where id = :'todo18_id'::uuid) is not null,
  '完了時にcompleted_atが記録されること'
);

-- 未完了に戻す
update public.todos set is_done = false, completed_at = null where id = :'todo18_id'::uuid;
select is(
  (select is_done from public.todos where id = :'todo18_id'::uuid),
  false,
  '再度チェックを外すと未完了に戻ること'
);
select ok(
  (select completed_at from public.todos where id = :'todo18_id'::uuid) is null,
  '未完了に戻すとcompleted_atがクリアされること'
);

-- 編集
update public.todos set title = '飲み物とお菓子を買う' where id = :'todo18_id'::uuid;
select is(
  (select title from public.todos where id = :'todo18_id'::uuid),
  '飲み物とお菓子を買う',
  'ToDoのタイトルを編集できること'
);

-- 非メンバーは編集・削除できない
set local role postgres;
insert into auth.users (id) values ('88888888-9999-0000-1111-222222222223');
set local role authenticated;
set local request.jwt.claim.sub = '88888888-9999-0000-1111-222222222223';
update public.todos set title = '不正な変更' where id = :'todo18_id'::uuid;
select is(
  (select title from public.todos where id = :'todo18_id'::uuid),
  '飲み物とお菓子を買う',
  '非メンバーが編集を試みても変更されないこと'
);

delete from public.todos where id = :'todo18_id'::uuid;
select ok(
  exists(select 1 from public.todos where id = :'todo18_id'::uuid),
  '非メンバーが削除を試みても削除されないこと'
);

-- カレンダーメンバーによる削除は成功する
set local request.jwt.claim.sub = '88888888-9999-0000-1111-222222222221';
delete from public.todos where id = :'todo18_id'::uuid;
select ok(
  not exists(select 1 from public.todos where id = :'todo18_id'::uuid),
  'カレンダーメンバーによる削除は成功すること'
);

select * from finish();
rollback;
