import { Image, type ImageStyle, type StyleProp } from "react-native";

// Monochrome "template" PNGs (black glyph on transparent background) that get
// recolored per-usage via the `tintColor` style, so every icon in the app
// shares one consistent look/weight instead of mismatched emoji glyphs -
// only the *color* varies by context (see the color conventions used at each
// call site: blue for primary/links, gray for neutral/secondary, red for
// destructive actions).
const ICONS = {
  bell: require("../../../assets/icons/bell.png"),
  "bell-off": require("../../../assets/icons/bell-off.png"),
  gear: require("../../../assets/icons/gear.png"),
  trash: require("../../../assets/icons/trash.png"),
  link: require("../../../assets/icons/link.png"),
  note: require("../../../assets/icons/note.png"),
  search: require("../../../assets/icons/search.png"),
  close: require("../../../assets/icons/close.png"),
  plus: require("../../../assets/icons/plus.png"),
  "chevron-down": require("../../../assets/icons/chevron-down.png"),
  "chevron-right": require("../../../assets/icons/chevron-right.png"),
  location: require("../../../assets/icons/location.png"),
  clock: require("../../../assets/icons/clock.png"),
} as const;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<ImageStyle>;
  testID?: string;
}

export function Icon({ name, size = 18, color = "#666", style, testID }: IconProps) {
  return (
    <Image
      testID={testID}
      source={ICONS[name]}
      resizeMode="contain"
      style={[{ width: size, height: size, tintColor: color }, style]}
    />
  );
}
