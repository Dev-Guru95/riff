// Small presentational pieces shared by the Kanban screens, matching the web's
// inline markup: the initials bubble, a <select>-like field and the
// muted section caption used by CardModal.

import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { Icon, Text } from "@/components/ui";
import { colors, fonts, radius, TOUCH } from "@/theme/tokens";
import { initials } from "./utils";

/** Web: `rounded-full bg-[var(--surface-2)] border grid place-items-center font-bold`. */
export function Initials({ name, size = 28, background = colors.surface2 }: { name: string; size?: number; background?: string }) {
  return (
    <View
      accessibilityLabel={name}
      style={[styles.bubble, { width: size, height: size, borderRadius: size / 2, backgroundColor: background }]}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: Math.max(9, Math.round(size * 0.36)), lineHeight: Math.round(size * 0.5), color: colors.foreground }}>
        {initials(name) || "?"}
      </Text>
    </View>
  );
}

/** A tappable stand-in for the web's `<select>`: shows the current option, opens a sheet. */
export function SelectField({
  value,
  onPress,
  disabled,
  accessibilityLabel,
  style,
}: {
  value: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ? `${accessibilityLabel}: ${value}` : value}
      style={({ pressed }) => [styles.select, pressed && { borderColor: colors.brand }, disabled && { opacity: 0.6 }, style]}
    >
      <Text style={{ flex: 1 }} numberOfLines={1}>{value}</Text>
      <Icon name="chevronDown" size={14} color={colors.muted} />
    </Pressable>
  );
}

/** CardModal's `Section` / `Label` caption: text-xs muted. */
export function Caption({ children }: { children: React.ReactNode }) {
  return <Text variant="caption" style={{ marginBottom: 6 }}>{children}</Text>;
}

const styles = StyleSheet.create({
  bubble: { borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  select: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: TOUCH,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
});
