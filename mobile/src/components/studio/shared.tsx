// Small building blocks shared by the Studio tool screens: money/date helpers
// that match the web clients, a status picker, a native date field, an
// "input + Add" bar, a 44pt icon button and a modal form sheet.

import { useCallback, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";

import { errorMessage } from "@/api/errors";
import { Button, Field, Icon, Pill, Text, type IconName } from "@/components/ui";
import { colors, fonts, radius, TOUCH } from "@/theme/tokens";

// ───────────── money & dates (same rules as the web) ─────────────

/** `$1,234` (dashboard) or `$1,234.56` (finance) from integer cents. */
export function money(cents: number, decimals: 0 | 2 = 2) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
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

/** Cents → the editable string the web pre-fills (`""` for 0). */
export const centsInput = (cents: number) => (cents ? String(cents / 100) : "");

/** `Mar 4, 2026` */
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/** The web stores a picked calendar day as noon UTC so it never shifts a day. */
export function dayToIso(d: Date) {
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `${ymd}T12:00:00.000Z`;
}
/** ISO (noon UTC) → a local Date on the same calendar day, for the picker. */
function isoToLocalDay(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y ?? 2000, (m ?? 1) - 1, d ?? 1, 12);
}
/** Calendar day of a stored ISO date, formatted, without timezone drift. */
export const fmtDay = (iso: string) =>
  isoToLocalDay(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/** `for_sale` → `For sale` */
export const label = (s: string) => {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Pull-to-refresh state for FlashList screens (only spins for user pulls). */
export function usePullRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);
  return { refreshing, onRefresh };
}

// ───────────── controls ─────────────

/** Horizontal pill picker for an enum (status, category, platform…). */
export function OptionPills<T extends string>({
  options,
  value,
  onChange,
  title,
}: {
  options: readonly T[];
  value: string;
  onChange: (v: T) => void;
  title?: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      {title ? <Text variant="caption" weight="medium" color={colors.foreground}>{title}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
        {options.map((o) => (
          <Pill key={o} label={label(o)} active={value === o} onPress={() => onChange(o)} />
        ))}
      </ScrollView>
    </View>
  );
}

/** A 44pt square icon button (remove ✕, etc.). */
export function IconButton({
  icon,
  label: a11y,
  onPress,
  color = colors.muted,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      style={({ pressed }) => [s.iconBtn, pressed && { backgroundColor: colors.surface2 }, disabled && { opacity: 0.4 }]}
    >
      <Icon name={icon} size={18} color={color} />
    </Pressable>
  );
}

/** Text field + "Add" button, like the web's quick-add rows. Clears on success. */
export function AddBar({
  placeholder,
  onAdd,
  loading,
  buttonTitle = "Add",
  maxLength,
}: {
  placeholder: string;
  onAdd: (value: string) => Promise<unknown> | void;
  loading?: boolean;
  buttonTitle?: string;
  maxLength?: number;
}) {
  const [value, setValue] = useState("");
  const submit = async () => {
    const v = value.trim();
    if (!v) return;
    try {
      await onAdd(v);
      setValue("");
    } catch {
      // The mutation already toasted the error; keep the text so it can be retried.
    }
  };
  return (
    <View style={s.addRow}>
      <View style={{ flex: 1 }}>
        <Field
          value={value}
          onChangeText={setValue}
          placeholder={placeholder}
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
          maxLength={maxLength}
          accessibilityLabel={placeholder}
        />
      </View>
      <Button title={buttonTitle} onPress={() => void submit()} loading={loading} disabled={!value.trim()} />
    </View>
  );
}

/**
 * Native date field. iOS shows the compact system picker inline; Android shows
 * a row that opens the Material date dialog. `value` is an ISO string or null.
 */
export function DateField({
  label: title,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (iso: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = value ? isoToLocalDay(value) : new Date();

  return (
    <View style={{ gap: 6 }}>
      <Text variant="caption" weight="medium" color={colors.foreground}>{title}</Text>
      <View style={s.dateRow}>
        {Platform.OS === "ios" ? (
          value ? (
            <DateTimePicker
              value={current}
              mode="date"
              display="compact"
              themeVariant="dark"
              accentColor={colors.brand}
              onValueChange={(_e, d) => onChange(dayToIso(d))}
            />
          ) : (
            <Pressable accessibilityRole="button" onPress={() => onChange(dayToIso(new Date()))} style={s.dateBtn}>
              <Icon name="calendar" size={16} color={colors.muted} />
              <Text color={colors.muted}>Set date</Text>
            </Pressable>
          )
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${title}: ${value ? fmtDay(value) : "not set"}`}
            onPress={() => setOpen(true)}
            style={s.dateBtn}
          >
            <Icon name="calendar" size={16} color={colors.muted} />
            <Text color={value ? colors.foreground : colors.muted}>{value ? fmtDay(value) : "Set date"}</Text>
          </Pressable>
        )}
        {value ? <Button title="Clear" size="sm" variant="link" onPress={() => onChange(null)} /> : null}
      </View>
      {open && Platform.OS !== "ios" ? (
        <DateTimePicker
          value={current}
          mode="date"
          presentation="dialog"
          accentColor={colors.brand}
          onValueChange={(_e, d) => {
            setOpen(false);
            onChange(dayToIso(d));
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </View>
  );
}

/** A tappable square checkbox row (goal milestones). */
export function CheckRow({
  checked,
  text,
  onToggle,
  onRemove,
}: {
  checked: boolean;
  text: string;
  onToggle: () => void;
  onRemove?: () => void;
}) {
  return (
    <View style={s.checkRow}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={text}
        onPress={onToggle}
        style={s.checkHit}
      >
        <View style={[s.box, checked && { backgroundColor: colors.brand, borderColor: colors.brand }]}>
          {checked ? <Icon name="check" size={14} color={colors.white} strokeWidth={2.2} /> : null}
        </View>
        <Text style={[{ flex: 1 }, checked && { textDecorationLine: "line-through", color: colors.muted }]}>{text}</Text>
      </Pressable>
      {onRemove ? <IconButton icon="close" label={`Remove ${text}`} onPress={onRemove} /> : null}
    </View>
  );
}

// ───────────── form sheet ─────────────

/**
 * Full-height modal form (page sheet on iOS). Toasts render under a modal, so
 * pass `error` to show a failed save inline.
 */
export function Sheet({
  visible,
  title,
  onClose,
  children,
  error,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  error?: unknown;
}) {
  const insets = useSafeAreaInsets();
  const ios = Platform.OS === "ios";
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={ios ? "pageSheet" : undefined}
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={[s.sheet, { paddingTop: ios ? 8 : insets.top }]}>
        <View style={s.sheetHead}>
          <Text variant="heading" style={{ flex: 1 }} numberOfLines={1} accessibilityRole="header">{title}</Text>
          <IconButton icon="close" label="Close" onPress={onClose} color={colors.foreground} />
        </View>
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.sheetBody, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          bottomOffset={24}
        >
          {error ? (
            <Text color={colors.danger} accessibilityLiveRegion="polite">{errorMessage(error)}</Text>
          ) : null}
          {children}
        </KeyboardAwareScrollView>
      </View>
    </Modal>
  );
}

/** "Track N" badge on hub tiles. */
export function TrackBadge({ track }: { track: number }) {
  return (
    <View style={s.track}>
      <Text style={s.trackText}>Track {track}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  iconBtn: { width: TOUCH, height: TOUCH, borderRadius: radius.field, alignItems: "center", justifyContent: "center" },
  addRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: TOUCH },
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: TOUCH,
    paddingHorizontal: 12,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  checkHit: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minHeight: TOUCH },
  box: {
    width: 22,
    height: 22,
    borderRadius: radius.sm + 2,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  sheet: { flex: 1, backgroundColor: colors.background },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetBody: { padding: 16, gap: 16 },
  track: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.surface2 },
  trackText: { fontSize: 10, lineHeight: 14, fontFamily: fonts.regular, color: colors.muted },
});
