const SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/**
 * Prepends "https://" to a URL that has no scheme (e.g. a bare domain like
 * "example.com" typed into an event's URL field), so it can be handed to
 * Linking.openURL - which otherwise fails silently on scheme-less input.
 * A URL that already has any scheme (http/https/mailto/...) is left as-is.
 */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (SCHEME_PATTERN.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}
