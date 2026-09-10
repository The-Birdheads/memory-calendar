-- カレンダーごとのデフォルト色を追加する。タグが付いていない予定は、この色で
-- 表示する(タグが付いていればタグの色が優先される)。既存カレンダーは
-- デフォルト値(青)から始まり、カレンダー設定画面で変更できる。
-- 更新権限は既存の calendars_update_owner ポリシー(オーナーのみ、列を問わず
-- 許可)がそのままカバーするので、ポリシーの追加は不要。

alter table public.calendars
  add column color text not null default '#2f6fed';
