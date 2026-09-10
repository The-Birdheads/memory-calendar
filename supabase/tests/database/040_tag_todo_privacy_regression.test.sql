-- タスク19.2: タグ・ToDoの非公開性の回帰テスト
-- 別アカウントから、自分が作成したタグ・ToDoおよびそれらの予定への紐付けが
-- 一切参照できないことを、共有予定を舞台に一括で検証する(要件10.10, 9.2)

begin;
select plan(8);

-- セットアップ: 同じ共有カレンダー・共有予定に参加する2ユーザー。
-- それぞれが自分のタグとToDoを同じ予定に対して作成する。
set local role postgres;
insert into auth.users (id) values
  ('eeeeeeee-ffff-0000-1111-222222222201'), -- user1
  ('eeeeeeee-ffff-0000-1111-222222222202'); -- user2

set local role authenticated;
set local request.jwt.claim.sub = 'eeeeeeee-ffff-0000-1111-222222222201';
insert into public.calendars (name) values ('共有カレンダー') returning id \gset cal_

set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role)
  values (:'cal_id'::uuid, 'eeeeeeee-ffff-0000-1111-222222222202', 'viewer');

set local role authenticated;
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'cal_id', '共有予定', '2026-09-24T10:00:00+00', '2026-09-24T11:00:00+00')
  returning id \gset event_

insert into public.tags (level, name, color) values ('major', 'user1の秘密のタグ', '#ff0000') returning id \gset tag1_
insert into public.event_tags (event_id, tag_id) values (:'event_id', :'tag1_id');
insert into public.todos (event_id, title) values (:'event_id', 'user1の秘密のToDo') returning id \gset todo1_

set local request.jwt.claim.sub = 'eeeeeeee-ffff-0000-1111-222222222202';
insert into public.tags (level, name, color) values ('major', 'user2の秘密のタグ', '#00ff00') returning id \gset tag2_
insert into public.event_tags (event_id, tag_id) values (:'event_id', :'tag2_id');
insert into public.todos (event_id, title) values (:'event_id', 'user2の秘密のToDo') returning id \gset todo2_

-- user1視点: 自分のタグ・ToDoのみが見える。user2のものは一切見えない
set local request.jwt.claim.sub = 'eeeeeeee-ffff-0000-1111-222222222201';
select is(
  (select array_agg(name order by name) from public.tags),
  array['user1の秘密のタグ'],
  'user1にはuser1自身のタグのみが見えること'
);
select is(
  (select array_agg(title order by title) from public.todos),
  array['user1の秘密のToDo'],
  'user1にはuser1自身のToDoのみが見えること'
);
select is(
  (select array_agg(t.name) from public.event_tags et join public.tags t on t.id = et.tag_id
     where et.event_id = :'event_id'::uuid),
  array['user1の秘密のタグ'],
  'user1には自分のタグの予定への紐付けのみが見えること'
);

-- user2視点: 同様に自分のものだけが見え、user1のものは一切見えない
set local request.jwt.claim.sub = 'eeeeeeee-ffff-0000-1111-222222222202';
select is(
  (select array_agg(name order by name) from public.tags),
  array['user2の秘密のタグ'],
  'user2にはuser2自身のタグのみが見えること'
);
select is(
  (select array_agg(title order by title) from public.todos),
  array['user2の秘密のToDo'],
  'user2にはuser2自身のToDoのみが見えること'
);
select is(
  (select array_agg(t.name) from public.event_tags et join public.tags t on t.id = et.tag_id
     where et.event_id = :'event_id'::uuid),
  array['user2の秘密のタグ'],
  'user2には自分のタグの予定への紐付けのみが見えること'
);

-- user2はuser1のタグ・ToDoを直接IDで参照しても取得できない
select is(
  (select count(*) from public.tags where id = :'tag1_id'::uuid),
  0::bigint,
  'user2はuser1のタグをIDで直接参照しても取得できないこと'
);
select is(
  (select count(*) from public.todos where id = :'todo1_id'::uuid),
  0::bigint,
  'user2はuser1のToDoをIDで直接参照しても取得できないこと'
);

select * from finish();
rollback;
