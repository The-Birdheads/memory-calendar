-- タスク4.3: 繰り返しシリーズの生成(終了日必須・最大1年)を検証する

begin;
select plan(19);

-- event_series テーブルの構造
select has_table('public', 'event_series', 'event_series テーブルが存在すること');
select has_column('public', 'event_series', 'recurrence_rule', 'event_series.recurrence_rule 列が存在すること');
select has_column('public', 'event_series', 'start_at', 'event_series.start_at 列が存在すること');
select has_column('public', 'event_series', 'recurrence_end_at', 'event_series.recurrence_end_at 列が存在すること');
select col_is_pk('public', 'event_series', 'id', 'event_series.id が主キーであること');
select is(
  (select relrowsecurity from pg_class where oid = 'public.event_series'::regclass),
  true,
  'event_series テーブルで RLS が有効であること'
);
select policies_are(
  'public', 'event_series',
  array['event_series_select_member'],
  'event_series に想定通りのRLSポリシーが定義されていること'
);

-- events.series_id 列が追加されていること
select has_column('public', 'events', 'series_id', 'events.series_id 列が存在すること');
select col_is_fk('public', 'events', 'series_id', 'events.series_id が外部キー(event_series参照)であること');

select has_function(
  'public', 'create_recurring_series',
  'create_recurring_series() 関数が存在すること'
);

set local role postgres;
insert into auth.users (id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1');
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
insert into public.calendars (name) values ('繰り返し検証用') returning id \gset cal5_

-- CHECK制約: recurrence_end_at は start_at から1年を超えられない(RLSを回避しテーブル制約のみを直接検証)
set local role postgres;
select throws_ok(
  format(
    $$ insert into public.event_series (calendar_id, recurrence_rule, start_at, recurrence_end_at)
       values (%L, 'daily', '2026-01-01T00:00:00+00', '2027-01-02T00:00:00+00') $$,
    :'cal5_id'
  ),
  '23514',
  null,
  'recurrence_end_atがstart_atから1年を超える場合はCHECK制約で拒否されること'
);
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';

-- 実際の生成: 2週間分の毎週予定(3回: 9/1, 9/8, 9/15)
select * from public.create_recurring_series(
  :'cal5_id'::uuid, '毎週ミーティング', '2026-09-01T10:00:00+00', '2026-09-01T11:00:00+00',
  'weekly', '2026-09-15T10:00:00+00'
);

select is(
  (select count(*) from public.events where calendar_id = :'cal5_id'::uuid and title = '毎週ミーティング'),
  3::bigint,
  '開始日から終了日までの各回(3回)がeventsに個別行として生成されること'
);
select is(
  (select count(distinct series_id) from public.events
     where calendar_id = :'cal5_id'::uuid and title = '毎週ミーティング'),
  1::bigint,
  '生成された全ての回が共通のseries_idで紐づけられること'
);
select is(
  (select end_at - start_at from public.events
     where calendar_id = :'cal5_id'::uuid and title = '毎週ミーティング'
     order by start_at limit 1),
  interval '1 hour',
  '各回の所要時間(終了-開始)が元の指定通り保持されること'
);

-- 終了日未指定はエラーで登録が行われない
select throws_ok(
  format(
    $$ select * from public.create_recurring_series(
         %L::uuid, '終了日なし', '2026-10-01T10:00:00+00', '2026-10-01T11:00:00+00',
         'daily', null
       ) $$,
    :'cal5_id'
  ),
  'A0003',
  null,
  '終了日未指定の場合はエラーとなり登録が行われないこと'
);
select is(
  (select count(*) from public.events where calendar_id = :'cal5_id'::uuid and title = '終了日なし'),
  0::bigint,
  '終了日未指定時はeventsが1件も作成されないこと'
);

-- 開始日から1年を超える終了日はエラーで登録が行われない
select throws_ok(
  format(
    $$ select * from public.create_recurring_series(
         %L::uuid, '1年超過', '2026-01-01T00:00:00+00', '2026-01-01T01:00:00+00',
         'monthly', '2027-01-02T00:00:00+00'
       ) $$,
    :'cal5_id'
  ),
  'A0003',
  null,
  '開始日から1年を超える終了日はエラーとなり登録が行われないこと'
);
select is(
  (select count(*) from public.events where calendar_id = :'cal5_id'::uuid and title = '1年超過'),
  0::bigint,
  '1年超過時はeventsが1件も作成されないこと'
);

-- 非メンバーはシリーズを生成できない
set local role postgres;
insert into auth.users (id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2');
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2';
select throws_ok(
  format(
    $$ select * from public.create_recurring_series(
         %L::uuid, '非メンバー', '2026-11-01T10:00:00+00', '2026-11-01T11:00:00+00',
         'daily', '2026-11-03T10:00:00+00'
       ) $$,
    :'cal5_id'
  ),
  '42501',
  null,
  '非メンバーはシリーズを生成できないこと'
);

select * from finish();
rollback;
