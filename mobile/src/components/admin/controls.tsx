// Small form controls the admin screens share. Native stand-ins for the web
// admin's <select>, checkbox, radio and number inputs, all with 44pt targets.

import { Pressable, StyleSheet, View } from "react-native";

import { Card, Field, Icon, Text } from "@/components/ui";
import { colors, fonts, radius, tint, TOUCH } from "@/theme/tokens";

/** A <select> replacement: a wrapping row of pill options. */
export function OptionPicker<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label?: string;
  value: T;
  options: readonly T[] | { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  const opts = (options as readonly (T | { value: T; label: string })[]).map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text variant="caption" weight="medium" color={colors.foreground}>{label}</Text> : null}
      <View style={s.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {opts.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: active, disabled: !!disabled }}
              accessibilityLabel={label ? `${label}: ${o.label}` : o.label}
              disabled={disabled}
              onPress={() => {
                if (!active) onChange(o.value);
              }}
              style={({ pressed }) => [
                s.option,
                active && s.optionActive,
                disabled && { opacity: 0.5 },
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
            >
              <Text style={[s.optionText, active && s.optionTextActive]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Checkbox row (the web's `<input type="checkbox">` + label). */
export function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={s.checkRow}
    >
      <View style={[s.box, checked && s.boxOn]}>{checked ? <Icon name="check" size={14} color={colors.white} strokeWidth={2} /> : null}</View>
      <Text style={{ flex: 1 }}>{label}</Text>
    </Pressable>
  );
}

/** Radio dot used to mark a quiz option as the correct answer. */
export function RadioDot({ selected, onPress, label }: { selected: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={s.radioHit}
    >
      <View style={[s.radio, selected && { borderColor: colors.success }]}>{selected ? <View style={s.radioInner} /> : null}</View>
    </Pressable>
  );
}

/** Numeric field that keeps a string while typing and reports an integer. */
export function NumberField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  hint?: string;
}) {
  return (
    <Field
      label={label}
      hint={hint}
      value={Number.isFinite(value) ? String(value) : ""}
      onChangeText={(t) => {
        const n = parseInt(t.replace(/[^0-9]/g, ""), 10);
        onChange(Number.isFinite(n) ? n : 0);
      }}
      keyboardType="number-pad"
      inputMode="numeric"
    />
  );
}

/** Shown in place of write controls when the server would refuse them. */
export function ViewOnlyNote({ role, needs }: { role: string; needs: string }) {
  return (
    <Card style={s.note}>
      <Icon name="lock" size={16} color={colors.muted} />
      <Text variant="caption" style={{ flex: 1 }}>
        View only. Changes here need the {needs} role{role ? ` (you are ${role})` : ""}.
      </Text>
    </Card>
  );
}

/** Uppercase section label used inside cards. */
export function Label({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <Text variant="label" style={{ flexShrink: 1 }}>{children}</Text>
      {right}
    </View>
  );
}

/** Quoted block for user content (submission text, report preview). */
export function Quote({ children }: { children: React.ReactNode }) {
  return <View style={s.quote}>{children}</View>;
}

const s = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    minHeight: TOUCH,
    paddingHorizontal: 14,
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  optionActive: { borderColor: tint(colors.brand, 0.8), backgroundColor: tint(colors.brand, 0.18) },
  optionText: { fontSize: 13, fontFamily: fonts.medium, color: colors.muted },
  optionTextActive: { fontFamily: fonts.semibold, color: colors.foreground },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: TOUCH },
  box: {
    width: 22,
    height: 22,
    borderRadius: radius.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  radioHit: { width: 32, height: TOUCH, alignItems: "center", justifyContent: "center" },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success },
  note: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  quote: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    gap: 6,
  },
});
