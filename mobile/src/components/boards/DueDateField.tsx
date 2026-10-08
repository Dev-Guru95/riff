// Due-date control. Uses the date picker that ships in @expo/ui
// (`@expo/ui/community/datetime-picker`, a drop-in for
// @react-native-community/datetimepicker): a Material dialog on Android, an
// inline compact picker on iOS. Like the web's <input type="date">, the picked
// calendar day is stored as that day at 12:00 UTC.

import { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";

import { Button, Icon, Text } from "@/components/ui";
import { colors, fonts, radius, TOUCH } from "@/theme/tokens";
import { isOverdue } from "./utils";

/** ISO (stored at 12:00 UTC) → local Date on the same calendar day. */
function isoToLocal(iso: string | null) {
  if (!iso) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  }
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y!, m! - 1, d!, 12);
}
/** Local Date → that calendar day at 12:00 UTC, matching the web. */
function localToIso(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T12:00:00.000Z`;
}

export function DueDateField({
  value,
  editable,
  onChange,
}: {
  value: string | null;
  editable: boolean;
  onChange: (iso: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const local = isoToLocal(value);
  const overdue = isOverdue(value);
  const label = value ? local.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "No due date";

  if (Platform.OS === "ios" && editable) {
    return (
      <View style={styles.row}>
        {value ? (
          <DateTimePicker
            value={local}
            mode="date"
            display="compact"
            themeVariant="dark"
            accentColor={colors.brand}
            onValueChange={(_e, d) => onChange(localToIso(d))}
          />
        ) : (
          <Button title="Set due date" size="sm" variant="ghost" icon="calendar" onPress={() => onChange(localToIso(local))} />
        )}
        {value ? <Button title="Clear" size="sm" variant="link" onPress={() => onChange(null)} /> : null}
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Pressable
        disabled={!editable}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Due date: ${label}`}
        accessibilityHint={editable ? "Opens a date picker" : undefined}
        style={({ pressed }) => [styles.field, pressed && { borderColor: colors.brand }, !editable && { opacity: 0.7 }]}
      >
        <Icon name="calendar" size={16} color={overdue ? colors.danger : colors.muted} />
        <Text style={{ fontFamily: fonts.medium }} color={overdue ? colors.danger : value ? colors.foreground : colors.muted}>
          {label}
        </Text>
      </Pressable>
      {editable && value ? <Button title="Clear" size="sm" variant="link" onPress={() => onChange(null)} /> : null}
      {open ? (
        <DateTimePicker
          value={local}
          mode="date"
          presentation="dialog"
          accentColor={colors.brand}
          onValueChange={(_e, d) => {
            setOpen(false);
            onChange(localToIso(d));
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  field: {
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
});
