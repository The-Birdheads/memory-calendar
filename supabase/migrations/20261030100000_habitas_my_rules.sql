-- Habitas 1.4.0: マイルール(一日を通して守りたいこと。一日の終わりに ○ / × をつける)
-- 種類に 'rule' を足す。○ は今までどおり 'done'、× は 'missed'
alter table habitas.tasks
  drop constraint tasks_task_type_check,
  add constraint tasks_task_type_check check (task_type in ('habit', 'oneoff', 'rule'));

alter table habitas.task_entries
  drop constraint task_entries_status_check,
  add constraint task_entries_status_check check (status in ('todo', 'doing', 'done', 'missed'));
