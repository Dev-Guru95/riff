// Small building blocks the admin screens share: native stand-ins for the web
// admin's <select>, checkbox, radio, number and range inputs (44pt targets),
// plus the few web admin styles the shared ui kit doesn't have (card headings,
// the admin empty state, inline success/error lines).

import { useState } from "react";
import { Platform, Pressable, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";

import { Card, Field, Icon, Text, type IconName } from "@/components/ui";
import { colors, fonts, radius, tint, TOUCH } from "@/theme/tokens";

/** The web's `font-mono` (codes, secrets, URLs) — the platform monospace face. */
export const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

/** A <select> replacement: a wrapping row of pill options. */
export function OptionPicker<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  compact,
}: {
  label?: string;
  value: T;
  options: readonly T[] | { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
  /** Smaller pills (the web's text-xs table selects). */
  compact?: boolean;
}) {
  const opts = (options as readonly (T | { value: T; label: string })[]).map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text variant="caption">{label}</Text> : null}
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
              hitSlop={compact ? 4 : 0}
              onPress={() => {
                if (!active) onChange(o.value);
              }}
              style={({ pressed }) => [
                s.option,
                compact && s.optionCompact,
                active && s.optionActive,
                disabled && { opacity: 0.5 },
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
            >
              <Text style={[s.optionText, compact && { fontSize: 12 }, active && s.optionTextActive]}>{o.label}</Text>
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
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => onChange(!checked)} style={s.checkRow}>
      <CheckBox checked={checked} />
      <Text style={{ flex: 1 }}>{label}</Text>
    </Pressable>
  );
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <View style={[s.box, checked && s.boxOn]}>{checked ? <Icon name="check" size={14} color={colors.white} strokeWidth={2} /> : null}</View>
  );
}

/** Radio dot (or checkbox, for multi-answer questions) marking a correct answer. */
export function RadioDot({ selected, onPress, label, multi }: { selected: boolean; onPress: () => void; label: string; multi?: boolean }) {
  return (
    <Pressable
      accessibilityRole={multi ? "checkbox" : "radio"}
      accessibilityState={multi ? { checked: selected } : { selected }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={s.radioHit}
    >
      {multi ? (
        <CheckBox checked={selected} />
      ) : (
        <View style={[s.radio, selected && { borderColor: colors.brand }]}>{selected ? <View style={s.radioInner} /> : null}</View>
      )}
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

/**
 * The web's `<input type="range" min max>`: drag or tap the track; screen
 * readers get increment / decrement actions. Pure JS (the gesture responder
 * system), so it needs no extra native module.
 */
export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  accessibilityLabel,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (n: number) => void;
  accessibilityLabel: string;
}) {
  const [width, setWidth] = useState(0);

  const fromX = (x: number) => {
    if (width <= 0) return min;
    const ratio = Math.max(0, Math.min(1, x / width));
    return Math.max(min, Math.min(max, Math.round((min + ratio * (max - min)) / step) * step));
  };
  const onTouch = (e: GestureResponderEvent) => onChange(fromX(e.nativeEvent.locationX));

  const pct = max > min ? ((Math.max(min, Math.min(max, value)) - min) / (max - min)) * 100 : 0;
  const THUMB = 18;

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "increment") onChange(Math.min(max, value + step * 5));
        if (e.nativeEvent.actionName === "decrement") onChange(Math.max(min, value - step * 5));
      }}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      // Gesture responder props (no PanResponder/refs needed): tap or drag.
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      // Keep the drag while the list around it would like to scroll.
      onResponderTerminationRequest={() => false}
      onResponderGrant={onTouch}
      onResponderMove={onTouch}
      style={s.sliderHit}
    >
      <View pointerEvents="none" style={s.sliderTrack}>
        <View style={[s.sliderFill, { width: `${pct}%` }]} />
      </View>
      {width > 0 ? (
        <View pointerEvents="none" style={[s.sliderThumb, { width: THUMB, height: THUMB, borderRadius: THUMB / 2, left: (pct / 100) * width - THUMB / 2 }]} />
      ) : null}
    </View>
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

/** Uppercase section label (web: text-xs font-semibold uppercase tracking-wide muted). */
export function Label({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <Text variant="label" style={{ flexShrink: 1 }}>{children}</Text>
      {right}
    </View>
  );
}

/** Card heading: the web's `<h2 className="text-sm font-semibold">` (or `font-semibold` at 16). */
export function CardTitle({ children, size = 14, style }: { children: React.ReactNode; size?: 14 | 16; style?: object }) {
  return (
    <Text accessibilityRole="header" style={[{ fontFamily: fonts.semibold, fontSize: size, lineHeight: size === 14 ? 20 : 24, color: colors.foreground }, style]}>
      {children}
    </Text>
  );
}

/** The web's EmptyState: 40px line icon, text-sm muted title, text-xs muted hint, py-16. */
export function AdminEmpty({ title, hint, icon = "cactus" }: { title: string; hint?: string; icon?: IconName }) {
  return (
    <View style={s.empty}>
      <Icon name={icon} size={40} strokeWidth={1.25} color={colors.muted} />
      <Text variant="small" style={{ textAlign: "center", marginTop: 12 }}>{title}</Text>
      {hint ? <Text variant="caption" style={{ textAlign: "center", marginTop: 4, maxWidth: 320 }}>{hint}</Text> : null}
    </View>
  );
}

/** A success (green) or error (pink) line, as the web admin forms show them. */
export function InlineMsg({ ok, children, small }: { ok: boolean; children: React.ReactNode; small?: boolean }) {
  return (
    <Text variant={small ? "caption" : "body"} color={ok ? colors.success : colors.danger} accessibilityLiveRegion="polite">
      {children}
    </Text>
  );
}

/** Rounded surface-2 tag without a border (the web's `px-2 py-0.5 rounded-full bg-surface-2`). */
export function Tag({ label }: { label: string }) {
  return (
    <View style={s.tag}>
      <Text style={{ fontSize: 12, lineHeight: 16, color: colors.foreground }}>{label}</Text>
    </View>
  );
}

/** Quoted block for user content (submission text, report preview). */
export function Quote({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[s.quote, style]}>{children}</View>;
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
  optionCompact: { minHeight: 32, paddingHorizontal: 10, borderRadius: radius.md },
  optionActive: { borderColor: tint(colors.brand, 0.8), backgroundColor: tint(colors.brand, 0.18) },
  optionText: { fontSize: 13, fontFamily: fonts.medium, color: colors.muted },
  optionTextActive: { fontFamily: fonts.semibold, color: colors.foreground },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: TOUCH },
  box: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  radioHit: { width: 32, height: TOUCH, alignItems: "center", justifyContent: "center" },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
  sliderHit: { height: TOUCH, justifyContent: "center", flex: 1, minWidth: 120 },
  sliderTrack: { height: 6, borderRadius: radius.pill, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  sliderFill: { height: "100%", backgroundColor: colors.brand },
  sliderThumb: { position: "absolute", top: (TOUCH - 18) / 2, backgroundColor: colors.foreground, borderWidth: 2, borderColor: colors.brand },
  note: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 64, paddingHorizontal: 16 },
  tag: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.surface2 },
  quote: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    gap: 6,
  },
});
