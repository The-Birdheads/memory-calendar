import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const MAX_RATING = 5;
const STAR_NUMBERS = Array.from({ length: MAX_RATING }, (_, i) => i + 1);

export interface RatingStarsProps {
  /** 1〜5、未評価はnull。 */
  rating: number | null;
  /** 渡すとタップで編集できるようになる。省略すると読み取り専用(表示のみ)。 */
  onChange?: (rating: number | null) => void;
  size?: number;
  testIDPrefix?: string;
}

/**
 * 献立の評価(★1〜5)を表示/編集する。「振り返るときのバリエーションが
 * 広がる」ための目印として、記録一覧・編集フォームの両方で使う共通部品。
 * onChangeを渡さない場合は読み取り専用になり、未評価(null)なら何も
 * 描画しない(一覧で☆を並べて視線のノイズにならないように)。
 */
export function RatingStars({ rating, onChange, size = 16, testIDPrefix = "rating-stars" }: RatingStarsProps) {
  if (!onChange) {
    if (rating === null) return null;
    return (
      <View style={styles.row} testID={`${testIDPrefix}-readonly`}>
        {STAR_NUMBERS.map((n) => (
          <Text
            key={n}
            testID={`${testIDPrefix}-readonly-star-${n}`}
            style={[styles.star, { fontSize: size }, n <= rating ? styles.starFilled : styles.starEmpty]}
          >
            {n <= rating ? "★" : "☆"}
          </Text>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.row} testID={testIDPrefix}>
      {STAR_NUMBERS.map((n) => (
        <TouchableOpacity
          key={n}
          testID={`${testIDPrefix}-${n}`}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          onPress={() => onChange(rating === n ? null : n)}
        >
          <Text
            testID={`${testIDPrefix}-${n}-label`}
            style={[styles.star, { fontSize: size }, rating !== null && n <= rating ? styles.starFilled : styles.starEmpty]}
          >
            {rating !== null && n <= rating ? "★" : "☆"}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 2,
  },
  star: {
    fontWeight: "700",
  },
  starFilled: {
    color: "#f0a942",
  },
  starEmpty: {
    color: "#ddd",
  },
});
