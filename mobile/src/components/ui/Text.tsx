import { Text as RNText, type TextProps, type TextStyle } from "react-native";

import { colors, fonts, type as scale } from "@/theme/tokens";

type Variant = "title" | "heading" | "body" | "small" | "caption" | "label" | "overline";
type Weight = "regular" | "medium" | "semibold" | "bold";

const VARIANTS: Record<Variant, TextStyle> = {
  // Page title: 24 bold, tight leading (web .text-2xl font-bold)
  title: { ...scale["2xl"], fontFamily: fonts.bold, color: colors.foreground },
  heading: { ...scale.lg, fontFamily: fonts.semibold, color: colors.foreground },
  body: { ...scale.sm, fontFamily: fonts.regular, color: colors.foreground },
  small: { ...scale.sm, fontFamily: fonts.regular, color: colors.muted },
  caption: { ...scale.xs, fontFamily: fonts.regular, color: colors.muted },
  // Section headings: text-sm font-semibold muted uppercase tracking-wide (most web pages).
  label: { ...scale.sm, fontFamily: fonts.semibold, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.35 },
  // The smaller text-xs uppercase eyebrow some web cards use ("Current plan").
  overline: { ...scale.xs, fontFamily: fonts.regular, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.3 },
};

export function Text({
  variant = "body",
  weight,
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; weight?: Weight; color?: string }) {
  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={1.4}
      style={[VARIANTS[variant], weight ? { fontFamily: fonts[weight] } : null, color ? { color } : null, style]}
    />
  );
}
