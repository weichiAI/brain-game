export const THEME_STYLES = [
  "quadratic",
  "nomad",
  "honey",
  "zen-garden",
  "highlighter",
] as const;

export type ThemeStyle = (typeof THEME_STYLES)[number];

export const DEFAULT_THEME_STYLE: ThemeStyle = "nomad";
