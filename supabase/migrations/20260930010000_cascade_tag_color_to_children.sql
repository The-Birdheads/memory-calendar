-- 大分類タグの色を変更したら、その中分類の子タグ(さらにその小分類の孫タグ)の
-- 色も自動で追従させる。これまでは親タグを選んだ瞬間に薄めた色を一度だけ
-- スナップショットしていたため、あとから親の色だけ変えても子タグの色は
-- 古いまま残っていた。
--
-- アプリ側のlightenHexColor(src/shared/utils/color.ts)と同じ計算(白方向に
-- amount=0.35だけブレンド)をSQLで再実装し、大分類→中分類のUPDATEが中分類→
-- 小分類のUPDATEを誘発する形で2階層分をトリガーの連鎖だけで伝播させる
-- (同じテーブルへのAFTER UPDATE OF colorトリガーが、トリガー内のUPDATEに
-- 対しても通常通り発火する性質を利用)。

create or replace function public.lighten_hex_color(hex text, amount numeric)
returns text
language plpgsql
immutable
as $$
declare
  r int;
  g int;
  b int;
begin
  if hex is null then
    return null;
  end if;

  r := get_byte(decode(substring(hex from 2 for 2), 'hex'), 0);
  g := get_byte(decode(substring(hex from 4 for 2), 'hex'), 0);
  b := get_byte(decode(substring(hex from 6 for 2), 'hex'), 0);

  r := round(r + (255 - r) * amount);
  g := round(g + (255 - g) * amount);
  b := round(b + (255 - b) * amount);

  return '#' || lpad(to_hex(r), 2, '0') || lpad(to_hex(g), 2, '0') || lpad(to_hex(b), 2, '0');
end;
$$;

create or replace function public.cascade_tag_color_to_children()
returns trigger
language plpgsql
as $$
begin
  if new.color is not distinct from old.color then
    return new;
  end if;

  if new.level = 'major' then
    update public.tags
    set color = public.lighten_hex_color(new.color, 0.35)
    where parent_id = new.id and level = 'mid';
  elsif new.level = 'mid' then
    update public.tags
    set color = public.lighten_hex_color(new.color, 0.35)
    where parent_id = new.id and level = 'minor';
  end if;

  return new;
end;
$$;

create trigger cascade_tag_color_to_children_trigger
  after update of color on public.tags
  for each row execute function public.cascade_tag_color_to_children();
