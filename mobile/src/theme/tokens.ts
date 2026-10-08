// Design tokens ported 1:1 from the web's src/app/globals.css (:root) so the app
// and the site share one visual identity. Riff is dark-only on the web too.

export const colors = {
  background: "#0a0a0f",
  surface: "#14141c",
  surface2: "#1c1c28",
  border: "#2a2a3a",
  foreground: "#ededf2",
  muted: "#9a9ab0",
  brand: "#8b5cf6",
  brand2: "#ec4899",
  accent: "#22d3ee",
  success: "#34d399",
  warning: "#fbbf24",
  danger: "#ec4899", // the web uses brand-2 as its danger tone
  white: "#ffffff",
  overlay: "rgba(10,10,15,0.9)",
} as const;

/** `.btn-primary` and the progress fill. Pass to expo-linear-gradient. */
export const gradients = {
  brand: { colors: [colors.brand, colors.brand2] as const, start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  progress: { colors: [colors.brand, colors.accent] as const, start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
};

/** Tinted chip border: the tone colour at 40% alpha, as on the web. */
export const tint = (hex: string, alpha = 0.4) =>
  hex + Math.round(alpha * 255).toString(16).padStart(2, "0");

export const radius = { sm: 4, md: 8, field: 10, card: 12, xl: 16, pill: 999 } as const;

// Tailwind's 4px grid.
export const space = (n: number) => n * 4;

// Geist is the UI face; Pirata One is only the "Riff" wordmark.
export const fonts = {
  regular: "Geist_400Regular",
  medium: "Geist_500Medium",
  semibold: "Geist_600SemiBold",
  bold: "Geist_700Bold",
  display: "PirataOne_400Regular",
} as const;

// Tailwind type scale used on the web: [fontSize, lineHeight].
export const type = {
  xs: { fontSize: 12, lineHeight: 16 },
  sm: { fontSize: 14, lineHeight: 20 },
  base: { fontSize: 16, lineHeight: 24 },
  lg: { fontSize: 18, lineHeight: 28 },
  xl: { fontSize: 20, lineHeight: 28 },
  "2xl": { fontSize: 24, lineHeight: 30 },
  "3xl": { fontSize: 30, lineHeight: 36 },
} as const;

/** Minimum touch target, matching the web's coarse-pointer rule. */
export const TOUCH = 44;
