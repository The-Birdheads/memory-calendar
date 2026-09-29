-- 個人設定でカレンダーの週の開始曜日(日曜始まり/月曜始まり)を選べるようにする。
-- 既存のprofiles_update_ownポリシー(本人のみ更新可)がそのままカバーするので、
-- ポリシーの追加は不要。

alter table public.profiles
  add column week_starts_on smallint not null default 0 check (week_starts_on in (0, 1));
