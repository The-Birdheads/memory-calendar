-- タスク17.1: 予定削除通知用のDB Webhookトリガーと、削除済みイベントを冪等性キーに
-- 記録できるようnotification_log.event_idのFK制約が緩和されていることを検証する

begin;
select plan(4);

select has_trigger(
  'public', 'events', 'event_change_notifier_on_event_delete',
  'events テーブルに削除通知用のDB Webhookトリガーが定義されていること'
);

select ok(
  not exists(
    select 1 from pg_constraint
    where conrelid = 'public.notification_log'::regclass
      and confrelid = 'public.events'::regclass
      and contype = 'f'
  ),
  'notification_log.event_id はevents(id)へのFK制約を持たないこと(削除済みイベントのidを記録するため)'
);

-- セットアップ: 予定を削除し、その削除済みevent_idを冪等性キーとして記録できることを確認する
set local role postgres;
insert into auth.users (id) values ('66666666-7777-8888-9999-000000000001');
insert into public.calendars (name, created_by) values ('削除通知検証用', '66666666-7777-8888-9999-000000000001') returning id \gset cal_
insert into public.events (calendar_id, title, start_at, end_at, created_by, updated_by)
  values (:'cal_id', '削除通知検証予定', '2026-09-23T10:00:00+00', '2026-09-23T11:00:00+00',
          '66666666-7777-8888-9999-000000000001', '66666666-7777-8888-9999-000000000001')
  returning id \gset event_

delete from public.events where id = :'event_id'::uuid;

insert into public.notification_log (type, target_user_id, event_id, status)
  values ('event_deleted', '66666666-7777-8888-9999-000000000001', :'event_id'::uuid, 'sent');

select is(
  (select count(*) from public.notification_log
     where type = 'event_deleted' and event_id = :'event_id'::uuid),
  1::bigint,
  '削除済みイベントのidをnotification_logに記録できること'
);

-- 冪等性: 同一(type, target_user_id, event_id)の重複記録は引き続き一意制約で拒否される
select throws_ok(
  format(
    $$ insert into public.notification_log (type, target_user_id, event_id, status)
       values ('event_deleted', '66666666-7777-8888-9999-000000000001', %L, 'sent') $$,
    :'event_id'::uuid
  ),
  '23505',
  null,
  '削除通知も同一キーの重複記録は一意制約で拒否されること(冪等性)'
);

select * from finish();
rollback;
