-- タスク11.3: 繰り返しシリーズ作成の集約通知(event_series_creation_events)を検証する

begin;
select plan(11);

select has_table(
  'public', 'event_series_creation_events',
  'event_series_creation_events テーブルが存在すること'
);
select has_column(
  'public', 'event_series_creation_events', 'event_count',
  'event_series_creation_events.event_count 列が存在すること'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.event_series_creation_events'::regclass),
  true,
  'event_series_creation_events テーブルで RLS が有効であること'
);
select has_column(
  'public', 'notification_log', 'series_id',
  'notification_log.series_id 列が追加されていること'
);
select has_trigger(
  'public', 'event_series_creation_events', 'event_change_notifier_on_series_creation',
  'event_series_creation_events テーブルに集約通知用のDB Webhookトリガーが定義されていること'
);

-- セットアップ
set local role postgres;
insert into auth.users (id) values ('66666666-6666-7777-8888-999999999991');
set local role authenticated;
set local request.jwt.claim.sub = '66666666-6666-7777-8888-999999999991';
insert into public.calendars (name) values ('集約通知検証用') returning id \gset cal24_

-- 過去に3回分の繰り返し予定を生成する
select * from public.create_recurring_series(
  :'cal24_id'::uuid, '毎週の集まり', '2026-09-01T10:00:00+00', '2026-09-01T11:00:00+00',
  'weekly', '2026-09-15T10:00:00+00'
);

-- シリーズ作成につきevent_series_creation_eventsが1件のみ生成される(集約)
select is(
  (select count(*) from public.event_series_creation_events where calendar_id = :'cal24_id'::uuid),
  1::bigint,
  'シリーズ作成時にevent_series_creation_eventsが1件のみ生成されること(個々の回ごとではない)'
);
select is(
  (select event_count from public.event_series_creation_events where calendar_id = :'cal24_id'::uuid),
  3::bigint,
  'event_countが実際に生成された回数(3回)と一致すること'
);

-- 生成された各回のeventsは全てseries_idが設定されている
-- (events INSERT時のDB Webhookトリガーはseries_id IS NULLのみを対象とするため、
--  個々の回に対する個別通知は発火しない設計になっていることを構造的に確認する)
select is(
  (select count(*) from public.events
     where calendar_id = :'cal24_id'::uuid and title = '毎週の集まり' and series_id is null),
  0::bigint,
  '繰り返しシリーズの各回はseries_idが設定されており、個別通知トリガーの対象外であること'
);

-- notification_log: series_idをキーとした冪等性(同一type/target/seriesの重複記録は拒否される)
set local role postgres;
insert into public.notification_log (type, target_user_id, series_id, status)
  values (
    'series_created', '66666666-6666-7777-8888-999999999991',
    (select series_id from public.event_series_creation_events where calendar_id = :'cal24_id'::uuid limit 1),
    'sent'
  );

select throws_ok(
  $$ insert into public.notification_log (type, target_user_id, series_id, status)
     values (
       'series_created', '66666666-6666-7777-8888-999999999991',
       (select series_id from public.event_series_creation_events where calendar_id = :'cal24_id'::uuid limit 1),
       'sent'
     ) $$,
  '23505',
  null,
  'series_idをキーとした重複記録は一意制約で拒否されること(冪等性)'
);

-- 非メンバーはevent_series_creation_eventsを閲覧できない
set local role postgres;
insert into auth.users (id) values ('66666666-6666-7777-8888-999999999992');
set local role authenticated;
set local request.jwt.claim.sub = '66666666-6666-7777-8888-999999999992';
select is(
  (select count(*) from public.event_series_creation_events where calendar_id = :'cal24_id'::uuid),
  0::bigint,
  '非メンバーはevent_series_creation_eventsを閲覧できないこと'
);

-- カレンダーメンバーは閲覧できる
set local request.jwt.claim.sub = '66666666-6666-7777-8888-999999999991';
select is(
  (select count(*) from public.event_series_creation_events where calendar_id = :'cal24_id'::uuid),
  1::bigint,
  'カレンダーメンバーはevent_series_creation_eventsを閲覧できること'
);

select * from finish();
rollback;
