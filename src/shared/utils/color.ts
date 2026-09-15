/**
 * Lightens a "#rrggbb" hex color by blending it toward white.
 * `amount` is a 0-1 fraction of the distance to white (0 = unchanged, 1 = white).
 * Used to derive a mid/minor tag's color as a lighter shade of its parent's color.
 */
export function lightenHexColor(hex: string, amount: number): string {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.substring(0, 2), 16);
  const g = parseInt(normalized.substring(2, 4), 16);
  const b = parseInt(normalized.substring(4, 6), 16);

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return hex;
  }

  const lighten = (channel: number) => Math.round(channel + (255 - channel) * amount);
  const toHex = (channel: number) => channel.toString(16).padStart(2, "0");

  return `#${toHex(lighten(r))}${toHex(lighten(g))}${toHex(lighten(b))}`;
}

/**
 * Converts a "#rrggbb" (or shorthand "#rgb") hex color to an "rgba(r, g, b, a)"
 * string, for a translucent background derived from an event's solid color.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized;

  const r = parseInt(expanded.substring(0, 2), 16);
  const g = parseInt(expanded.substring(2, 4), 16);
  const b = parseInt(expanded.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
