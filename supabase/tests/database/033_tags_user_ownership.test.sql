-- タスク15.1: タグをカレンダー所有からユーザー所有へ移行したことを検証する

begin;
select plan(7);

select has_column('public', 'tags', 'user_id', 'tags.user_id 列が存在すること');
select col_is_fk('public', 'tags', 'user_id', 'tags.user_id が外部キー(profiles参照)であること');
select ok(
  not exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tags' and column_name = 'calendar_id'
  ),
  'tags.calendar_id 列が削除されていること'
);
select policies_are(
  'public', 'tags',
  array['tags_delete_own', 'tags_insert_own', 'tags_select_own', 'tags_update_own'],
  'tags がユーザー本人所有のRLSポリシー構成になっていること'
);

-- セットアップ: 2つのカレンダーに参加するユーザー1名
set local role postgres;
insert into auth.users (id) values ('55555555-6666-7777-8888-999999999991');

set local role authenticated;
set local request.jwt.claim.sub = '55555555-6666-7777-8888-999999999991';
insert into public.calendars (name) values ('カレンダーA') returning id \gset calA_
insert into public.calendars (name) values ('カレンダーB') returning id \gset calB_

-- 作成したタグはどのカレンダーにも紐づかない
insert into public.tags (level, name, color) values ('major', '共通タグ', '#ff0000') returning id \gset tagShared_

select is(
  (select user_id from public.tags where id = :'tagShared_id'::uuid),
  '55555555-6666-7777-8888-999999999991'::uuid,
  '作成したタグは作成者本人に紐づくこと'
);

-- 参加する複数カレンダーいずれの予定に対しても共通のタグとして選択・紐付けできること(要件10.9)
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'calA_id', 'カレンダーAの予定', '2026-09-20T10:00:00+00', '2026-09-20T11:00:00+00')
  returning id \gset eventA_
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'calB_id', 'カレンダーBの予定', '2026-09-21T10:00:00+00', '2026-09-21T11:00:00+00')
  returning id \gset eventB_

insert into public.event_tags (event_id, tag_id) values (:'eventA_id', :'tagShared_id');
insert into public.event_tags (event_id, tag_id) values (:'eventB_id', :'tagShared_id');

select is(
  (select count(*) from public.event_tags where tag_id = :'tagShared_id'::uuid),
  2::bigint,
  '同じタグを参加する複数カレンダーいずれの予定にも紐付けられること'
);

-- タグ一覧はカレンダーに依存せず、常に自分のタグ全件が返る
select is(
  (select count(*) from public.tags where user_id = '55555555-6666-7777-8888-999999999991'::uuid),
  1::bigint,
  'タグ一覧の取得がカレンダーに依存しないこと'
);

select * from finish();
rollback;
