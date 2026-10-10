// Small building blocks shared by the Studio tool screens, matching the web
// clients under src/app/(app)/studio/** at phone width:
//  - money/date helpers with the web's exact rules
//  - the web's two input looks (`inp` compact inputs and the `.field` class)
//  - an input that saves on blur (the web's `defaultValue` + `onBlur` rows)
//  - a native <select>, a native <input type="date">
//  - the web's section heading, GoalBar, EmptyState, square Avatar
//  - an optimistic write helper (the web's "patch locally, reload on failure")

import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { KeyboardAwareScrollView, type KeyboardAwareScrollViewRef } from "react-native-keyboard-controller";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

import { api } from "@/api/client";
import { errorMessage } from "@/api/errors";
import { Button, Icon, Modal, ProgressBar, Text, useToast, type IconName } from "@/components/ui";
import { useInvalidate } from "@/hooks/useApi";
import { colors, fonts, radius, TOUCH } from "@/theme/tokens";

// ───────────── money & dates (same rules as the web) ─────────────

/** `$1,234` (dashboard, maximumFractionDigits 0) or `$1,234.56` (finance) from integer cents. */
export function money(cents: number, decimals: 0 | 2 = 2) {
  return `$${(cents / 100).toLocaleString(undefined, decimals === 2 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 })}`;
}

/** Copy of the web's src/lib/money.ts toCents: user-typed money → integer cents. */
export function toCents(v: string): number {
  let s = (v ?? "").trim().replace(/\s/g, "");
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = /,\d{2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 100)) : 0;
}

/** Cents → the editable string the web pre-fills (`m.price ? m.price / 100 : ""`). */
export const centsInput = (cents: number) => (cents ? String(cents / 100) : "");

/** `Mar 4, 2026` — the web's fmtDate (finance). */
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/** The web stores a picked calendar day as `YYYY-MM-DDT12:00:00.000Z`. */
export function dayToIso(d: Date) {
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `${ymd}T12:00:00.000Z`;
}
/** The web's date inputs show `iso.slice(0, 10)`; this is that day as a local Date for the picker. */
function isoToLocalDay(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y ?? 2000, (m ?? 1) - 1, d ?? 1, 12);
}
/** The calendar day of a stored ISO date (its first 10 chars), formatted. */
export const fmtDay = (iso: string) =>
  isoToLocalDay(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/** CSS `capitalize` on a single-word enum; `for_sale` → `For sale` like `s.replace("_", " ")`. */
export const label = (s: string) => {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** The web's tag parsing: comma-separated, trimmed, empties dropped. */
export const splitTags = (s: string) => s.split(",").map((t) => t.trim()).filter(Boolean);

// ───────────── data ─────────────

/**
 * The web clients' write pattern: apply the change to the cached list at once,
 * send it, and on failure toast and re-sync from the server ("reload()").
 * `alsoInvalidate` refreshes other screens that show the same data (dashboard).
 */
export function useStudioWrite<T>(queryKey: QueryKey, alsoInvalidate: readonly string[] = []) {
  const qc = useQueryClient();
  const toast = useToast();
  const invalidate = useInvalidate();
  const listPath = String(queryKey[0]);
  const keyHash = JSON.stringify(queryKey);
  const alsoHash = alsoInvalidate.join("|");

  return useCallback(
    async <R = unknown,>(
      path: string,
      method: "POST" | "PATCH" | "DELETE",
      body?: unknown,
      update?: (old: T) => T,
      { reload = false }: { reload?: boolean } = {},
    ): Promise<R | undefined> => {
      const key = JSON.parse(keyHash) as QueryKey;
      if (update) qc.setQueryData<T>(key, (old) => (old === undefined ? old : update(old)));
      try {
        const res = await api<R>(path, { method, body: method === "DELETE" ? undefined : (body ?? {}) });
        const also = alsoHash ? alsoHash.split("|") : [];
        if (reload) await invalidate(listPath, ...also);
        else if (also.length) void invalidate(...also);
        return res;
      } catch (e) {
        toast(errorMessage(e), "error");
        void invalidate(listPath);
        return undefined;
      }
    },
    [qc, toast, invalidate, listPath, keyHash, alsoHash],
  );
}

/** A ScrollView for FlashList that keeps the focused input above the keyboard. */
export const KeyboardScroll = forwardRef<KeyboardAwareScrollViewRef, ScrollViewProps>(function KeyboardScroll(props, ref) {
  return <KeyboardAwareScrollView {...props} ref={ref} bottomOffset={24} keyboardShouldPersistTaps="handled" />;
});

// ───────────── type ─────────────

/** `h2.text-sm.font-semibold.text-[var(--muted)]` — the hub / caption section headings. */
export function SubHeading({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text variant="small" weight="semibold" accessibilityRole="header" style={style}>
      {children}
    </Text>
  );
}

/** `h2.font-semibold.text-sm` — a card's title (foreground). */
export function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text weight="semibold" accessibilityRole="header">
      {children}
    </Text>
  );
}

/** `text-xs text-[var(--muted)]` form label. */
export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text variant="caption">{children}</Text>;
}

// ───────────── inputs ─────────────

type InputProps = TextInputProps & {
  /** `inp` (rounded 4, compact — most Studio rows) or `field` (the `.field` class, radius 10). */
  look?: "inp" | "field";
  /** Text-size override for the title inputs (`text-lg font-semibold`, `font-medium`). */
  weight?: "medium" | "semibold";
  large?: boolean;
};

/** The web's Studio input: surface-2, 1px border, brand border on focus. */
export const Input = forwardRef<TextInput, InputProps>(function Input(
  { look = "inp", weight, large, style, multiline, editable = true, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.muted}
      selectionColor={colors.brand}
      multiline={multiline}
      editable={editable}
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
        look === "field" ? s.field : s.inp,
        multiline && s.multi,
        weight && { fontFamily: fonts[weight] },
        large && { fontSize: 18, lineHeight: 26 },
        focused && { borderColor: colors.brand },
        !editable && { opacity: 0.7 },
        style,
      ]}
    />
  );
});

/**
 * The web's `<input defaultValue onBlur={patch}>`: edits locally and calls
 * `onCommit` when the field loses focus (or the keyboard's Done is pressed, or
 * the screen closes with an unsaved edit). Key it by the server value so a
 * failed save re-syncs the text.
 */
export function CommitInput({
  initial,
  onCommit,
  ...rest
}: Omit<InputProps, "value" | "onChangeText" | "defaultValue"> & { initial: string; onCommit: (value: string) => void }) {
  const [value, setValue] = useState(initial);
  const pending = useRef<string | null>(null);
  const commitRef = useRef(onCommit);
  useEffect(() => {
    commitRef.current = onCommit;
  });

  const flush = useCallback(() => {
    if (pending.current === null) return;
    const v = pending.current;
    pending.current = null;
    commitRef.current(v);
  }, []);
  // Leaving the screen with the keyboard up never fires blur; save anyway.
  useEffect(() => flush, [flush]);

  return (
    <Input
      {...rest}
      value={value}
      onChangeText={(t) => {
        setValue(t);
        pending.current = t === initial ? null : t;
      }}
      onBlur={flush}
      onSubmitEditing={rest.multiline ? undefined : flush}
      returnKeyType={rest.multiline ? undefined : "done"}
    />
  );
}

/**
 * The web's quick-add row: `<input class="flex-1 inp">` + `btn-primary` "Add".
 * Enter / Add submits; like the web the box clears straight away.
 */
export function AddRow({
  placeholder,
  onAdd,
  buttonTitle = "Add",
  maxLength,
  look = "inp",
}: {
  placeholder: string;
  onAdd: (value: string) => void;
  buttonTitle?: string;
  maxLength?: number;
  look?: "inp" | "field";
}) {
  const [value, setValue] = useState("");
  const submit = () => {
    const v = value.trim();
    if (!v) return;
    setValue("");
    onAdd(v);
  };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Input
        look={look}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        returnKeyType="done"
        submitBehavior="submit"
        onSubmitEditing={submit}
        maxLength={maxLength}
        accessibilityLabel={placeholder}
        style={{ flex: 1 }}
      />
      <Button title={buttonTitle} onPress={submit} accessibilityLabel={buttonTitle === "+" ? `Add ${placeholder}` : undefined} />
    </View>
  );
}

// ───────────── select ─────────────

type Option<T extends string> = T | { value: T; label: string };
const optValue = <T extends string>(o: Option<T>) => (typeof o === "string" ? o : o.value);
const optLabel = <T extends string>(o: Option<T>) => (typeof o === "string" ? label(o) : o.label);

/** A native `<select>`: the current value in the web's select box; tap to choose from a list. */
export function Select<T extends string>({
  value,
  options,
  onChange,
  accessibilityLabel,
  style,
  look = "inp",
}: {
  value: string;
  options: readonly Option<T>[];
  onChange: (v: T) => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  look?: "inp" | "field";
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => optValue(o) === value);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel}: ${current ? optLabel(current) : value}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [look === "field" ? s.selectField : s.select, pressed && { borderColor: colors.brand }, style]}
      >
        <Text numberOfLines={1} style={{ flexShrink: 1 }}>{current ? optLabel(current) : label(value)}</Text>
        <Icon name="chevronDown" size={14} color={colors.muted} />
      </Pressable>
      {open ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent navigationBarTranslucent>
          <Pressable style={s.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close">
            <View style={s.menu} onStartShouldSetResponder={() => true}>
              <Text variant="caption" weight="medium" style={s.menuTitle}>{accessibilityLabel}</Text>
              <ScrollView style={{ maxHeight: 420 }}>
                {options.map((o) => {
                  const v = optValue(o);
                  const on = v === value;
                  return (
                    <Pressable
                      key={v}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      onPress={() => {
                        setOpen(false);
                        if (!on) onChange(v);
                      }}
                      style={({ pressed }) => [s.menuRow, pressed && { backgroundColor: colors.surface2 }]}
                    >
                      <Text style={{ flex: 1 }} weight={on ? "semibold" : "regular"}>{optLabel(o)}</Text>
                      {on ? <Icon name="check" size={16} color={colors.brand} /> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
}

// ───────────── date ─────────────

/**
 * The web's `<input type="date">`: shows the stored day, opens the system date
 * picker (Android dialog / iOS calendar sheet) and reports `YYYY-MM-DDT12:00:00.000Z`,
 * or `""` when cleared — exactly what the web sends.
 */
export function DateInput({ value, onChange, accessibilityLabel = "Date" }: { value: string | null; onChange: (iso: string) => void; accessibilityLabel?: string }) {
  const [open, setOpen] = useState(false);
  const current = value ? isoToLocalDay(value) : new Date();
  const pick = (d: Date) => {
    setOpen(false);
    onChange(dayToIso(d));
  };

  return (
    <View style={s.dateWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel}: ${value ? fmtDay(value) : "not set"}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [s.select, pressed && { borderColor: colors.brand }]}
      >
        <Text color={value ? colors.foreground : colors.muted}>{value ? fmtDay(value) : "mm/dd/yyyy"}</Text>
        <Icon name="calendar" size={14} color={colors.muted} />
      </Pressable>
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Clear ${accessibilityLabel}`} onPress={() => onChange("")} hitSlop={10} style={s.clear}>
          <Icon name="close" size={14} color={colors.muted} />
        </Pressable>
      ) : null}

      {open && Platform.OS !== "ios" ? (
        <DateTimePicker
          value={current}
          mode="date"
          presentation="dialog"
          accentColor={colors.brand}
          onValueChange={(_e, d) => pick(d)}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
      {open && Platform.OS === "ios" ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable style={s.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close">
            <View style={[s.menu, { padding: 8 }]} onStartShouldSetResponder={() => true}>
              <DateTimePicker
                value={current}
                mode="date"
                display="inline"
                themeVariant="dark"
                accentColor={colors.brand}
                onValueChange={(_e, d) => pick(d)}
              />
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

// ───────────── display ─────────────

/** The web's GoalBar: label, then a 6px bar with the rounded % to its right (w-9). */
export function GoalBar({ label: text, pct }: { label: string; pct: number }) {
  const safe = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <View style={{ gap: 6 }}>
      {text ? <Text>{text}</Text> : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <ProgressBar pct={safe} height={6} />
        </View>
        <Text variant="caption" style={{ width: 36, textAlign: "right" }}>{safe}%</Text>
      </View>
    </View>
  );
}

/** The web's EmptyState (ui.tsx): 40px line icon, text-sm muted title, py-16. */
export function StudioEmpty({ icon = "cactus", title, hint }: { icon?: IconName; title: string; hint?: string }) {
  return (
    <View style={s.empty}>
      <Icon name={icon} size={40} strokeWidth={1.25} color={colors.muted} />
      <Text variant="small" style={{ textAlign: "center", marginTop: 12 }}>{title}</Text>
      {hint ? <Text variant="caption" style={{ textAlign: "center", marginTop: 4, maxWidth: 320 }}>{hint}</Text> : null}
    </View>
  );
}

/** The web's `<Avatar square>`: rounded-lg, surface-2, muted initials. */
export function SquareAvatar({ name, size = 34 }: { name: string; size?: number }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <View style={[s.avatar, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={{ fontFamily: fonts.semibold, fontSize: size * 0.36, lineHeight: size * 0.5 }} color={colors.muted}>
        {initials || "?"}
      </Text>
    </View>
  );
}

/** The small ✕ remove control (`text-[var(--muted)] hover:text-[var(--brand-2)]`), 44pt hit area. */
export function RemoveButton({ label: a11y, onPress, size = 15 }: { label: string; onPress: () => void; size?: number }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} hitSlop={8} style={s.remove}>
      {({ pressed }) => <Icon name="close" size={size} color={pressed ? colors.brand2 : colors.muted} />}
    </Pressable>
  );
}

/** "Track N" badge on hub tiles (`text-[10px] px-1.5 py-0.5 rounded-full bg-surface-2 muted`). */
export function TrackBadge({ track }: { track: number }) {
  return (
    <View style={s.track}>
      <Text style={s.trackText}>Track {track}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  inp: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.foreground,
    minHeight: 40,
  },
  field: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.field,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.foreground,
    minHeight: TOUCH,
  },
  multi: { textAlignVertical: "top", minHeight: 64 },
  select: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  selectField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    minHeight: TOUCH,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  menu: {
    alignSelf: "stretch",
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
  },
  menuTitle: { paddingHorizontal: 16, paddingVertical: 8 },
  menuRow: { flexDirection: "row", alignItems: "center", minHeight: TOUCH, paddingHorizontal: 16, gap: 8 },
  dateWrap: { flexDirection: "row", alignItems: "center", gap: 2 },
  clear: { width: 32, height: 40, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 64, paddingHorizontal: 16 },
  avatar: {
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  remove: { minWidth: 32, minHeight: TOUCH, alignItems: "center", justifyContent: "center" },
  track: { marginLeft: "auto", paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.surface2 },
  trackText: { fontSize: 10, lineHeight: 14, fontFamily: fonts.regular, color: colors.muted },
});
