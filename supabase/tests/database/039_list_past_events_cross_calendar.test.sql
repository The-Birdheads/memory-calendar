-- タスク18.1: タグ絞り込みが自分のタグを軸にカレンダー横断で行われることを検証する
-- (list_past_events_by_tagは以後、単一カレンダー指定ではなく複数カレンダー配列指定になった)

begin;
select plan(8);

-- セットアップ: 参加する3つのカレンダーを持つユーザー(タグ所有者)
set local role postgres;
insert into auth.users (id) values
  ('dddddddd-eeee-ffff-0000-111111111101'), -- タグ所有者(3カレンダーに参加)
  ('dddddddd-eeee-ffff-0000-111111111102'); -- タグ非所有者(カレンダーAのみに参加)

set local role authenticated;
set local request.jwt.claim.sub = 'dddddddd-eeee-ffff-0000-111111111101';
insert into public.calendars (name) values ('カレンダーA') returning id \gset calA_
insert into public.calendars (name) values ('カレンダーB') returning id \gset calB_
insert into public.calendars (name) values ('カレンダーC') returning id \gset calC_

set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role)
  values (:'calA_id'::uuid, 'dddddddd-eeee-ffff-0000-111111111102', 'viewer');

set local role authenticated;
insert into public.tags (level, name, color) values ('major', '横断タグ', '#ff0000') returning id \gset tag_

-- カレンダーA・B・Cそれぞれに過去の予定を作成し、A・Bには同じタグを設定する
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'calA_id', 'カレンダーAの過去予定', '2026-01-01T10:00:00+00', '2026-01-01T11:00:00+00')
  returning id \gset eventA_
insert into public.event_tags (event_id, tag_id) values (:'eventA_id', :'tag_id');

insert into public.events (calendar_id, title, start_at, end_at)
  values (:'calB_id', 'カレンダーBの過去予定', '2026-01-02T10:00:00+00', '2026-01-02T11:00:00+00')
  returning id \gset eventB_
insert into public.event_tags (event_id, tag_id) values (:'eventB_id', :'tag_id');

insert into public.events (calendar_id, title, start_at, end_at)
  values (:'calC_id', 'カレンダーCの過去予定', '2026-01-03T10:00:00+00', '2026-01-03T11:00:00+00')
  returning id \gset eventC_

-- タグ未指定・カレンダー未指定: 参加する全カレンダーの過去予定が返る(要件11.1)
select is(
  (select count(*) from public.list_past_events_by_tag()),
  3::bigint,
  'タグ・カレンダーともに未指定の場合、参加する全カレンダーの過去予定が返ること'
);

-- タグ指定・カレンダー未指定: カレンダーを横断して同じタグの予定が返る(要件11.2)
select is(
  (select count(*) from public.list_past_events_by_tag(p_tag_id => :'tag_id'::uuid)),
  2::bigint,
  'タグ指定時、カレンダーを横断して同じタグが付いた予定が返ること'
);

-- タグ指定・カレンダー1件指定: 指定したカレンダーのみにさらに絞り込まれる(要件11.6)
select is(
  (select count(*) from public.list_past_events_by_tag(p_tag_id => :'tag_id'::uuid, p_calendar_ids => array[:'calA_id'::uuid])),
  1::bigint,
  'カレンダーを1件指定すると、そのカレンダーのみにさらに絞り込まれること'
);
select is(
  (select title from public.list_past_events_by_tag(p_tag_id => :'tag_id'::uuid, p_calendar_ids => array[:'calA_id'::uuid])),
  'カレンダーAの過去予定',
  'カレンダー指定時の絞り込み結果が正しいこと'
);

-- カレンダーを複数指定(A, B)すると、その2つの予定だけが横断して返る(カレンダー画面と同じ複数選択UIに対応)
select is(
  (select count(*) from public.list_past_events_by_tag(p_calendar_ids => array[:'calA_id'::uuid, :'calB_id'::uuid])),
  2::bigint,
  'カレンダーを複数指定すると、そのカレンダー群の予定だけが横断して返ること'
);

-- タグの所有者本人以外は、参加しているカレンダーであってもそのタグでの絞り込みはできない(要件10.10)
set local request.jwt.claim.sub = 'dddddddd-eeee-ffff-0000-111111111102';
select throws_ok(
  format($$ select * from public.list_past_events_by_tag(p_tag_id => %L) $$, :'tag_id'::uuid),
  '42501',
  null,
  'タグの所有者本人以外はそのタグで絞り込めないこと'
);

-- 参加していないカレンダーを指定した場合は拒否される
set local role postgres;
insert into auth.users (id) values ('dddddddd-eeee-ffff-0000-111111111103');
set local role authenticated;
set local request.jwt.claim.sub = 'dddddddd-eeee-ffff-0000-111111111103';
select throws_ok(
  format($$ select * from public.list_past_events_by_tag(p_calendar_ids => array[%L::uuid]) $$, :'calA_id'::uuid),
  '42501',
  null,
  '参加していないカレンダーを指定した場合は拒否されること'
);

-- 非メンバーはタグ・カレンダーともに未指定でも、そのカレンダーの予定は含まれない(自分が参加するカレンダーのみが対象)
select is(
  (select count(*) from public.list_past_events_by_tag()),
  0::bigint,
  'どのカレンダーにも参加していないユーザーには過去予定が1件も返らないこと'
);

select * from finish();
rollback;
