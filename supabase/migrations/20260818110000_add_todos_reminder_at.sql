-- タスク9.4: ToDoのリマインド日時設定
-- 配信対象は紐づく予定のevent_reminder_targetsを継承する仕様のため、ここでは日時の保存のみ行う

alter table public.todos
  add column reminder_at timestamptz;

create index todos_reminder_at_idx on public.todos (reminder_at) where reminder_at is not null and is_done = false;
