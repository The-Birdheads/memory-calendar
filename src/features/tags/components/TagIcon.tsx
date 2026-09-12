import { View } from "react-native";

export interface TagIconProps {
  size?: number;
  color?: string;
}

/**
 * まとめてタグ付与/削除モードの入口を示す「タグ」の簡易グリフ。既存の
 * FilterIcon(棒3本)と同じ方針で、画像アセットを増やさずPlain Viewだけで
 * 組む - 角丸の正方形を45度回転させたひし形(タグ本体)に、白い縁取りの
 * 小さな輪(タグの穴)を重ねる。輪はヘッダーの白背景を前提にした縁取り
 * だけの表現なので、白以外の背景に置く場合は見た目の調整が要る。
 */
export function TagIcon({ size = 18, color = "#444" }: TagIconProps) {
  const bodySize = size * 0.7;
  const holeSize = size * 0.24;
  const holeBorderWidth = Math.max(1.5, size * 0.09);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: bodySize,
          height: bodySize,
          borderRadius: bodySize * 0.22,
          backgroundColor: color,
          transform: [{ rotate: "45deg" }],
        }}
      />
      <View
        style={{
          position: "absolute",
          width: holeSize,
          height: holeSize,
          borderRadius: holeSize / 2,
          borderWidth: holeBorderWidth,
          borderColor: "#fff",
          top: size * 0.27,
          left: size * 0.27,
        }}
      />
    </View>
  );
}
