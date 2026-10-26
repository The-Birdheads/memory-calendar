-- Habitas 1.4.0 のマンダラチャートと習慣の頻度(20261027000000)を検証する。
-- RLS(本人のチャート・マスだけ)、頻度の制約、マスへのひもづけ、アカウント削除での削除を確認する。

begin;
select plan(21);

select has_table('habitas', 'mandala_charts', 'mandala_charts テーブルが存在すること');
select has_table('habitas', 'mandala_cells', 'mandala_cells テーブルが存在すること');
select has_table('habitas', 'mandala_cell_events', 'mandala_cell_events テーブルが存在すること');
select has_table('habitas', 'mandala_reviews', 'mandala_reviews テーブルが存在すること');
select has_column('habitas', 'tasks', 'frequency_kind', 'tasks.frequency_kind が存在すること');
select has_column('habitas', 'tasks', 'mandala_linked_at', 'tasks.mandala_linked_at が存在すること');

set local role postgres;
insert into auth.users (id) values
  ('53000000-0000-0000-0000-000000000001'), -- U1: チャートを作る
  ('53000000-0000-0000-0000-000000000002'); -- U2: 他人

-- ---------- U1: チャート・マス・ひもづけ ----------
set local role authenticated;
set local request.jwt.claim.sub = '53000000-0000-0000-0000-000000000001';

insert into habitas.mandala_charts (user_id, title)
  values ('53000000-0000-0000-0000-000000000001', '健康的な体をつくる') returning id \gset chart_
insert into habitas.mandala_cells (user_id, chart_id, element_index, cell_index, text, color)
  values ('53000000-0000-0000-0000-000000000001', :'chart_id'::uuid, 1, null, '睡眠', '#C2410C');
insert into habitas.mandala_cells (user_id, chart_id, element_index, cell_index, text)
  values ('53000000-0000-0000-0000-000000000001', :'chart_id'::uuid, 1, 0, '23時に寝る') returning id \gset cell_

select throws_ok(
  format($$ insert into habitas.mandala_cells (user_id, chart_id, element_index, cell_index, text)
            values ('53000000-0000-0000-0000-000000000001', %L, 1, null, '睡眠(重複)') $$, :'chart_id'),
  '23505',
  null,
  '要素のマス(cell_index が null)も、同じ位置に2つは作れないこと'
);

insert into habitas.tasks (user_id, title, task_type, frequency_kind, frequency_count, mandala_cell_id, mandala_linked_at)
  values ('53000000-0000-0000-0000-000000000001', 'ジムに行く', 'habit', 'weekly_count', 2, :'cell_id'::uuid, '2026-11-01')
  returning id \gset task_
select is(
  (select frequency_kind || ':' || frequency_count from habitas.tasks where id = :'task_id'::uuid),
  'weekly_count:2',
  'U1: 週2回の習慣を、マスにひもづけて作れること'
);

select throws_ok(
  $$ insert into habitas.tasks (user_id, title, task_type, frequency_kind)
     values ('53000000-0000-0000-0000-000000000001', '回数なし', 'habit', 'weekly_count') $$,
  '23514',
  null,
  '週n回なのに回数がない習慣は作れないこと'
);
select throws_ok(
  $$ insert into habitas.tasks (user_id, title, task_type, frequency_kind, frequency_days)
     values ('53000000-0000-0000-0000-000000000001', '曜日なし', 'habit', 'weekdays', 0) $$,
  '23514',
  null,
  '曜日指定なのに曜日が1つもない習慣は作れないこと'
);

insert into habitas.mandala_cell_events (user_id, cell_id, kind, note, task_id)
  values ('53000000-0000-0000-0000-000000000001', :'cell_id'::uuid, 'linked', '習慣「ジムに行く」をひもづけ', :'task_id'::uuid);
insert into habitas.mandala_reviews (user_id, chart_id, good_note, decisions, snapshot)
  values ('53000000-0000-0000-0000-000000000001', :'chart_id'::uuid, 'よかった', '["続ける"]', '{"title": "健康的な体をつくる"}');

-- ---------- U2: 他人のチャートは見えず、使えない ----------
set local request.jwt.claim.sub = '53000000-0000-0000-0000-000000000002';

select is(
  (select count(*) from habitas.mandala_charts)::int,
  0,
  'U2: 他人のチャートは見えないこと'
);
select is(
  (select count(*) from habitas.mandala_cells)::int,
  0,
  'U2: 他人のマスは見えないこと'
);
select throws_ok(
  format($$ insert into habitas.mandala_cells (user_id, chart_id, element_index, cell_index, text)
            values ('53000000-0000-0000-0000-000000000002', %L, 2, 0, '乗っ取り') $$, :'chart_id'),
  '42501',
  null,
  'U2: 他人のチャートにマスを作れないこと'
);
select throws_ok(
  format($$ insert into habitas.mandala_reviews (user_id, chart_id) values ('53000000-0000-0000-0000-000000000002', %L) $$, :'chart_id'),
  '42501',
  null,
  'U2: 他人のチャートに見直しの記録を作れないこと'
);
select throws_ok(
  format($$ insert into habitas.tasks (user_id, title, task_type, mandala_cell_id)
            values ('53000000-0000-0000-0000-000000000002', '他人のマスへ', 'habit', %L) $$, :'cell_id'),
  'P0001',
  'mandala_cell_id references a cell of another user',
  'U2: 自分の習慣を、他人のマスにひもづけられないこと'
);

-- ---------- 既存の習慣は「毎日」 ----------
insert into habitas.tasks (user_id, title, task_type)
  values ('53000000-0000-0000-0000-000000000002', '既存の習慣', 'habit');
select is(
  (select frequency_kind from habitas.tasks where title = '既存の習慣'),
  'daily',
  '頻度を指定しない習慣は「毎日」になること'
);

-- ---------- マスを消すと、ひもづけだけ外れる ----------
set local request.jwt.claim.sub = '53000000-0000-0000-0000-000000000001';
delete from habitas.mandala_cells where id = :'cell_id'::uuid;
select is(
  (select mandala_cell_id from habitas.tasks where id = :'task_id'::uuid),
  null,
  'U1: マスの行を消しても、習慣は残り、ひもづけだけが外れること'
);

-- ---------- 利用判定とアカウント削除 ----------
set local role postgres;
select is(
  public._app_in_use('53000000-0000-0000-0000-000000000001', 'habitas'),
  true,
  'U1: チャートがあれば Habitas を使っているとみなすこと'
);

set local role authenticated;
set local request.jwt.claim.sub = '53000000-0000-0000-0000-000000000001';
select public.register_app_use('memory_calendar');
select public.register_app_use('habitas');
select is(public.delete_app_data('habitas'), false, 'U1: Habitas のデータ削除(Memory Calendar も利用中)はアカウントを残す');

set local role postgres;
select is(
  (select count(*) from habitas.mandala_charts where user_id = '53000000-0000-0000-0000-000000000001')
  + (select count(*) from habitas.mandala_reviews where user_id = '53000000-0000-0000-0000-000000000001')
  + (select count(*) from habitas.mandala_cell_events where user_id = '53000000-0000-0000-0000-000000000001')
  + (select count(*) from habitas.tasks where user_id = '53000000-0000-0000-0000-000000000001'),
  0::bigint,
  'U1: チャート・見直しの記録・変更の履歴・習慣がすべて削除されること'
);
select is(
  (select count(*) from auth.users where id = '53000000-0000-0000-0000-000000000001')::int,
  1,
  'U1: アカウントは残ること'
);

select * from finish();
rollback;
