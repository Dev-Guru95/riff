// `.btn` / `.btn-primary` / `.btn-ghost` from the web, as native pressables:
// pill radius, brand gradient on primary, 44pt minimum touch target, and the
// web's `:active { scale(.97) }` press feedback.

import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { colors, fonts, gradients, radius, TOUCH } from "@/theme/tokens";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

/** primary = .btn-primary; ghost = .btn-ghost; danger = ghost with a pink border;
 *  destructive = solid brand-2 (the web's "Permanently delete"); link = bare text. */
type Variant = "primary" | "ghost" | "danger" | "destructive" | "link";
type Size = "md" | "sm";

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  loading,
  disabled,
  fullWidth,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const inactive = disabled || loading;
  const fg = variant === "primary" || variant === "destructive" ? colors.white : variant === "danger" ? colors.danger : variant === "link" ? colors.accent : colors.foreground;
  const content = (
    <View style={[styles.inner, size === "sm" && styles.innerSm]}>
      {loading ? <ActivityIndicator size="small" color={fg} /> : icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <Text style={[styles.label, size === "sm" && styles.labelSm, { color: fg }]} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      hitSlop={size === "sm" ? 6 : 0}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.full,
        variant === "ghost" && styles.ghost,
        variant === "danger" && styles.dangerBox,
        variant === "destructive" && styles.destructiveBox,
        variant === "link" && styles.linkBox,
        { opacity: inactive ? 0.45 : pressed && variant === "primary" ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
        style,
      ]}
    >
      {/* Background layer, not a wrapper: an absolutely-positioned child adds
          nothing to the Pressable's size, so the button is measured only by its
          label and can never inflate to fill whatever space is above it. */}
      {variant === "primary" ? (
        <LinearGradient {...gradients.brand} style={styles.gradient} pointerEvents="none" />
      ) : null}
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.pill, overflow: "hidden", minHeight: TOUCH, justifyContent: "center", alignSelf: "flex-start" },
  full: { alignSelf: "stretch" },
  // Fills the Pressable exactly. `base` clips it to the pill via overflow:hidden;
  // the radius here is belt-and-braces for Android, where clipping a rounded
  // parent has historically been unreliable.
  gradient: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.pill },
  inner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 20, minHeight: TOUCH },
  innerSm: { paddingVertical: 6, paddingHorizontal: 14, minHeight: 36 },
  label: { fontFamily: fonts.semibold, fontSize: 14.4 },
  labelSm: { fontSize: 13 },
  ghost: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  dangerBox: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.danger + "66" },
  destructiveBox: { backgroundColor: colors.brand2 },
  linkBox: { backgroundColor: "transparent" },
});
