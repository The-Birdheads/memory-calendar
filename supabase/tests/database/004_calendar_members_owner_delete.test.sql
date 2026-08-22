-- タスク3.3: オーナーによるメンバー削除を検証する

begin;
select plan(7);

select has_function(
  'public', 'is_calendar_owner', array['uuid', 'uuid'],
  'is_calendar_owner(uuid, uuid) 関数が存在すること'
);
select function_returns(
  'public', 'is_calendar_owner', array['uuid', 'uuid'], 'boolean',
  'is_calendar_owner は boolean を返すこと'
);
select policies_are(
  'public', 'calendar_members',
  array['calendar_members_delete_owner', 'calendar_members_select_member'],
  'calendar_members に想定通りのRLSポリシーが定義されていること'
);

-- セットアップ: owner/editor/viewerの3人が所属するカレンダー
set local role postgres;
insert into auth.users (id) values
  ('99999999-9999-9999-9999-999999999991'), -- owner
  ('99999999-9999-9999-9999-999999999992'), -- editor
  ('99999999-9999-9999-9999-999999999993'); -- viewer(削除対象)

set local role authenticated;
set local request.jwt.claim.sub = '99999999-9999-9999-9999-999999999991';
insert into public.calendars (name) values ('チーム') returning id \gset cal3_

set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role) values
  (:'cal3_id'::uuid, '99999999-9999-9999-9999-999999999992', 'editor'),
  (:'cal3_id'::uuid, '99999999-9999-9999-9999-999999999993', 'viewer');

-- オーナー以外(editor)がメンバー削除を試みても対象行は削除されない
set local role authenticated;
set local request.jwt.claim.sub = '99999999-9999-9999-9999-999999999992';
delete from public.calendar_members
where calendar_id = :'cal3_id'::uuid
  and user_id = '99999999-9999-9999-9999-999999999993';

select ok(
  exists(
    select 1 from public.calendar_members
    where calendar_id = :'cal3_id'::uuid
      and user_id = '99999999-9999-9999-9999-999999999993'
  ),
  'オーナー以外がメンバー削除を実行しても対象行は削除されないこと'
);

-- オーナーによるメンバー削除は成功する
set local request.jwt.claim.sub = '99999999-9999-9999-9999-999999999991';
delete from public.calendar_members
where calendar_id = :'cal3_id'::uuid
  and user_id = '99999999-9999-9999-9999-999999999993';

select ok(
  not exists(
    select 1 from public.calendar_members
    where calendar_id = :'cal3_id'::uuid
      and user_id = '99999999-9999-9999-9999-999999999993'
  ),
  'オーナーによるメンバー削除で対象メンバーがcalendar_membersから除外されること'
);

select ok(
  exists(
    select 1 from public.calendar_members
    where calendar_id = :'cal3_id'::uuid
      and user_id = '99999999-9999-9999-9999-999999999992'
  ),
  '削除対象以外のメンバーには影響しないこと'
);

select is(
  (select count(*) from public.calendar_members where calendar_id = :'cal3_id'::uuid),
  2::bigint,
  '削除後、ownerとeditorの2名がcalendar_membersに残っていること'
);

select * from finish();
rollback;
