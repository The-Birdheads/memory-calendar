import { Icon } from "../../../shared/components/Icon";

export interface TagIconProps {
  size?: number;
  color?: string;
}

/**
 * まとめてタグ付与/削除モードの入口に使う「タグ」アイコン。予定一覧の各行に出る
 * タグ有無のマーク(`<Icon name="tag" />`)と同じ画像を使い、アプリ内の
 * タグの絵を一つに揃えている。
 */
export function TagIcon({ size = 18, color = "#444" }: TagIconProps) {
  return <Icon name="tag" size={size} color={color} />;
}
