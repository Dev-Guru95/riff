// Native ports of the web's emoji `Stat` tile (src/components/ui.tsx) and
// `GoalRow` (src/components/GoalRow.tsx), used by the dashboard and the
// learning screens. The shared ui kit's StatCard is the line-icon variant.

import { StyleSheet, View } from "react-native";

import { ProgressBar, Text } from "@/components/ui";
import { colors, fonts, radius } from "@/theme/tokens";
import type { Goal } from "@/types/api";

/** `.card p-4 flex items-center gap-3`: 24px emoji, then a bold value over a muted label. */
export function Stat({ icon, value, label }: { icon: string; value: string | number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statIcon}>{icon}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{String(value)}</Text>
        <Text variant="caption" style={{ marginTop: 4 }} numberOfLines={1}>{label}</Text>
      </View>
    </View>
  );
}

/** One daily/weekly goal: ✅ or the goal's emoji, label · cadence, progress/target and a thin bar. */
export function GoalRow({ goal, cadence }: { goal: Goal; cadence: string }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.emoji, !goal.done && { opacity: 0.7 }]}>{goal.done ? "✅" : goal.icon}</Text>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <View style={styles.rowHead}>
          <Text style={{ flex: 1 }} color={goal.done ? colors.success : undefined}>
            {goal.label} <Text variant="caption">· {cadence}</Text>
          </Text>
          <Text variant="caption">
            {goal.progress}/{goal.target}
          </Text>
        </View>
        <ProgressBar pct={goal.pct} height={6} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stat: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
  },
  statIcon: { fontSize: 24, lineHeight: 32 },
  statValue: { fontSize: 20, lineHeight: 22, fontFamily: fonts.bold, color: colors.foreground },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowHead: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  emoji: { fontSize: 20, lineHeight: 28 },
});

/** The web's section heading: `text-sm font-semibold text-[var(--muted)] uppercase tracking-wide`. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text accessibilityRole="header" style={labelStyle}>
      {children}
    </Text>
  );
}

const labelStyle = {
  fontSize: 14,
  lineHeight: 20,
  fontFamily: fonts.semibold,
  color: colors.muted,
  textTransform: "uppercase",
  letterSpacing: 0.35,
} as const;
