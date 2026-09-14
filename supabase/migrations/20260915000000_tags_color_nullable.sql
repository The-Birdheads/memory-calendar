-- タグの色を未設定(null)にできるようにする。未設定の場合、表示時は
-- その予定が属するカレンダーの色にフォールバックする(アプリ側の
-- resolveEventColor/EventTagBadgesのfallbackColorで実装)。

alter table public.tags alter column color drop not null;

alter table public.tags drop constraint tags_color_check;
alter table public.tags add constraint tags_color_check
  check (color is null or color ~ '^#[0-9A-Fa-f]{6}$');
