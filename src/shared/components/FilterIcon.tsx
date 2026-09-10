import { StyleSheet, View } from "react-native";

export interface FilterIconProps {
  size?: number;
  color?: string;
}

/**
 * The common "filter/tune" glyph (three horizontal bars of decreasing
 * width) used to trigger FilterButton everywhere it appears. Built from
 * plain Views instead of an image asset or icon library, matching this
 * app's existing icon set (see shared/components/Icon.tsx) in spirit -
 * one consistent look wherever a filter control appears, without adding a
 * new dependency for a single glyph.
 */
export function FilterIcon({ size = 18, color = "#444" }: FilterIconProps) {
  const barHeight = Math.max(2, Math.round(size * 0.12));
  const gap = Math.max(2, Math.round(size * 0.16));
  const widths = [size, size * 0.68, size * 0.36];

  return (
    <View style={[styles.container, { gap }]}>
      {widths.map((width, index) => (
        <View
          key={index}
          style={[
            styles.bar,
            { width, height: barHeight, borderRadius: barHeight / 2, backgroundColor: color },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "flex-end",
  },
  bar: {},
});
