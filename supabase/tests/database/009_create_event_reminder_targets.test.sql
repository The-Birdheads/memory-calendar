-- タスク4.6(廃止): 予定のリマインダー対象者(event_reminder_targets)は
-- event_remindersによる個人単位のリマインド設定に置き換えられ、廃止された。
-- is_event_calendar_member はevent_remindersのRLSでも再利用されるため引き続き存在を検証する。
-- (詳細な置き換え後の挙動は 042_event_reminders.test.sql を参照)

begin;
select plan(3);

select has_function(
  'public', 'is_event_calendar_member', array['uuid', 'uuid'],
  'is_event_calendar_member(uuid, uuid) 関数が存在すること(event_remindersのRLSで再利用)'
);
select function_returns(
  'public', 'is_event_calendar_member', array['uuid', 'uuid'], 'boolean',
  'is_event_calendar_member は boolean を返すこと'
);
select hasnt_table(
  'public', 'event_reminder_targets',
  'event_reminder_targets テーブルは廃止され存在しないこと(event_remindersに置き換え)'
);

select * from finish();
rollback;
