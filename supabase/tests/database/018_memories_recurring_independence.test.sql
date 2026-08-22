-- タスク8.3: 繰り返し予定の各回が独立した思い出(写真・コメント)を持つことを検証する

begin;
select plan(5);

set local role postgres;
insert into auth.users (id) values ('66666666-7777-8888-9999-000000000001');
set local role authenticated;
set local request.jwt.claim.sub = '66666666-7777-8888-9999-000000000001';
insert into public.calendars (name) values ('思い出検証用') returning id \gset cal16_

-- 過去に3回分の繰り返し予定を生成する(毎週、2026-08-01〜2026-08-15)
select * from public.create_recurring_series(
  :'cal16_id'::uuid, '毎週の集まり', '2026-08-01T10:00:00+00', '2026-08-01T11:00:00+00',
  'weekly', '2026-08-15T10:00:00+00'
);

select is(
  (select count(*) from public.events where calendar_id = :'cal16_id'::uuid and title = '毎週の集まり'),
  3::bigint,
  '前提: 3回分の繰り返し予定が生成されていること'
);

-- 2回目の回にのみ写真とコメントを追加する
select id from public.events
  where calendar_id = :'cal16_id'::uuid and title = '毎週の集まり'
  order by start_at asc offset 1 limit 1 \gset secondOccurrence_

insert into public.event_photos (event_id, storage_path)
  values (:'secondOccurrence_id', :'secondOccurrence_id' || '/photo.jpg');
insert into public.event_comments (event_id, body)
  values (:'secondOccurrence_id', '2回目は楽しかった');

select is(
  (select count(*) from public.event_photos ep
     join public.events e on e.id = ep.event_id
     where e.calendar_id = :'cal16_id'::uuid and e.title = '毎週の集まり'),
  1::bigint,
  '写真は対象の1回にのみ存在すること'
);
select is(
  (select count(*) from public.event_comments ec
     join public.events e on e.id = ec.event_id
     where e.calendar_id = :'cal16_id'::uuid and e.title = '毎週の集まり'),
  1::bigint,
  'コメントは対象の1回にのみ存在すること'
);

-- 他の2回(1回目・3回目)には写真・コメントが一切存在しない
select is(
  (select count(*) from public.events e
     where e.calendar_id = :'cal16_id'::uuid and e.title = '毎週の集まり'
       and e.id <> :'secondOccurrence_id'::uuid
       and exists(select 1 from public.event_photos ep where ep.event_id = e.id)),
  0::bigint,
  '他の回には写真が存在しないこと(他の回の思い出に影響しない)'
);
select is(
  (select count(*) from public.events e
     where e.calendar_id = :'cal16_id'::uuid and e.title = '毎週の集まり'
       and e.id <> :'secondOccurrence_id'::uuid
       and exists(select 1 from public.event_comments ec where ec.event_id = e.id)),
  0::bigint,
  '他の回にはコメントが存在しないこと(他の回の思い出に影響しない)'
);

select * from finish();
rollback;
