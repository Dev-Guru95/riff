// Native equivalents of the web's shared primitives (src/components/ui.tsx and
// the .card / .chip / .pill / .field classes in globals.css).

import { forwardRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";

import { colors, fonts, gradients, radius, tint, TOUCH } from "@/theme/tokens";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

/** `.card`: surface, 1px border, radius 12. Pressable when given onPress. */
export function Card({
  children,
  onPress,
  style,
  padded = true,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  accessibilityLabel?: string;
}) {
  if (!onPress) return <View style={[styles.card, padded && styles.cardPad, style]}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.card, padded && styles.cardPad, pressed && styles.cardPressed, style]}
    >
      {children}
    </Pressable>
  );
}

type Tone = "muted" | "success" | "warning" | "danger" | "brand" | "accent";
const TONE: Record<Tone, string> = {
  muted: colors.muted,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  brand: colors.brand,
  accent: colors.accent,
};

/** `.chip` status badge: tone-coloured text with a 40%-alpha border. */
export function Chip({ label, tone = "muted", icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const c = TONE[tone];
  return (
    <View style={[styles.chip, tone !== "muted" && { borderColor: tint(c) }]}>
      {icon ? <Icon name={icon} size={11} color={c} /> : null}
      <Text style={[styles.chipText, { color: c }]}>{label}</Text>
    </View>
  );
}

/** `.pill` filter tab. */
export function Pill({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, active && styles.pillActive, pressed && { transform: [{ scale: 0.97 }] }]}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

/** `.field` input with label and inline error. 16px text so nothing zooms. */
export const Field = forwardRef<TextInput, TextInputProps & { label?: string; error?: string | null; hint?: string }>(
  function Field({ label, error, hint, style, multiline, ...rest }, ref) {
    const [focused, setFocused] = useState(false);
    return (
      <View style={styles.fieldWrap}>
        {label ? <Text variant="caption" weight="medium" style={styles.fieldLabel}>{label}</Text> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.muted}
          selectionColor={colors.brand}
          multiline={multiline}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[
            styles.field,
            multiline && styles.fieldMulti,
            focused && { borderColor: colors.brand },
            error ? { borderColor: colors.danger } : null,
            style,
          ]}
        />
        {error ? (
          <Text variant="caption" color={colors.danger} accessibilityLiveRegion="polite">{error}</Text>
        ) : hint ? (
          <Text variant="caption">{hint}</Text>
        ) : null}
      </View>
    );
  },
);

/** Gradient progress bar (8px; pass height 6 for the GoalBar look). */
export function ProgressBar({ pct, height = 8 }: { pct: number; height?: number }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <View style={[styles.track, { height }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(w) }}>
      <LinearGradient {...gradients.progress} style={{ width: `${w}%`, height: "100%", borderRadius: radius.pill }} />
    </View>
  );
}

/** SVG ring (stroke 6, surface2 track, brand arc, round caps). */
export function ProgressRing({ pct, size = 72, label }: { pct: number; size?: number; label?: string }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surface2} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.brand}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - p / 100)}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {label ? <Text variant="caption" weight="semibold" color={colors.foreground}>{label}</Text> : null}
    </View>
  );
}

/** StatCard: value 20 bold, label 12 muted, icon top-right. */
export function StatCard({ value, label, icon }: { value: string | number; label: string; icon?: IconName }) {
  return (
    <View style={[styles.card, styles.cardPad, styles.stat]}>
      {icon ? (
        <View style={styles.statIcon}>
          <Icon name={icon} size={18} color={colors.muted} />
        </View>
      ) : null}
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{String(value)}</Text>
      <Text variant="caption" numberOfLines={1}>{label}</Text>
    </View>
  );
}

/** Initials avatar on surface2 with a border. */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: size * 0.36, color: colors.foreground }}>{initials || "?"}</Text>
    </View>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}

/** A tappable settings/menu row with an icon and chevron. */
export function ListRow({
  icon,
  title,
  subtitle,
  onPress,
  right,
  destructive,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface2 }]}
    >
      {icon ? <Icon name={icon} size={18} color={destructive ? colors.danger : colors.muted} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text weight="medium" color={destructive ? colors.danger : undefined} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text variant="caption" numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Icon name="chevronRight" size={16} color={colors.muted} /> : null)}
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card },
  cardPad: { padding: 16 },
  cardPressed: { borderColor: colors.brand },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  chipText: { fontSize: 11, lineHeight: 15, fontFamily: fonts.medium },
  pill: { minHeight: 36, paddingVertical: 6, paddingHorizontal: 14, borderRadius: radius.pill, justifyContent: "center" },
  pillActive: { backgroundColor: colors.surface2 },
  pillText: { fontSize: 13, fontFamily: fonts.medium, color: colors.muted },
  pillTextActive: { fontFamily: fonts.semibold, color: colors.foreground },
  fieldWrap: { gap: 6 },
  fieldLabel: { color: colors.foreground },
  field: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.field,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.foreground,
    minHeight: TOUCH,
  },
  fieldMulti: { minHeight: 110, textAlignVertical: "top" },
  track: { backgroundColor: colors.surface2, borderRadius: radius.pill, overflow: "hidden", width: "100%" },
  stat: { flex: 1, minWidth: 0, gap: 2 },
  statIcon: { position: "absolute", top: 12, right: 12 },
  statValue: { fontSize: 20, lineHeight: 26, fontFamily: fonts.bold, color: colors.foreground },
  avatar: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 52 },
});
