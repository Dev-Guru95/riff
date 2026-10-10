// One card in a column, like the web's CardTile (BoardView.tsx): label bars,
// title, then the meta row — priority dot, 📅 due, completion %, ☑ checklist,
// 💬 comments, 📎 attachments and up to three assignee initials.

import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui";
import { colors, radius } from "@/theme/tokens";
import type { BoardCardDTO } from "@/types/boards";
import { Initials } from "./bits";
import { fmtDate, isOverdue, labelColor, PRIORITY } from "./utils";

export const CardTile = memo(function CardTile({
  card,
  onPress,
  onLongPress,
}: {
  card: BoardCardDTO;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const pr = card.priority ? PRIORITY[card.priority] : null;
  const overdue = isOverdue(card.dueDate);
  const checklistDone = card.checklist.total > 0 && card.checklist.done === card.checklist.total;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      accessibilityRole="button"
      accessibilityLabel={card.title}
      accessibilityHint={onLongPress ? "Long press for card actions" : undefined}
      style={({ pressed }) => [styles.tile, pressed && { borderColor: colors.brand }]}
    >
      {card.labels.length > 0 ? (
        <View style={styles.labels}>
          {card.labels.map((l) => (
            <View key={l.id} style={[styles.labelBar, { backgroundColor: labelColor(l.color) }]} accessibilityLabel={l.name} />
          ))}
        </View>
      ) : null}
      <Text>{card.title}</Text>
      <View style={styles.meta}>
        {pr ? (
          <View style={styles.metaItem}>
            <View style={[styles.dot, { backgroundColor: pr.color }]} />
            <Text variant="caption">{pr.label}</Text>
          </View>
        ) : null}
        {card.dueDate ? (
          <Text variant="caption" color={overdue ? colors.brand2 : undefined} weight={overdue ? "medium" : undefined}>
            📅 {fmtDate(card.dueDate)}
          </Text>
        ) : null}
        {card.completion > 0 ? <Text variant="caption">{card.completion}%</Text> : null}
        {card.checklist.total > 0 ? (
          <Text variant="caption" color={checklistDone ? colors.success : undefined}>
            ☑ {card.checklist.done}/{card.checklist.total}
          </Text>
        ) : null}
        {card.counts.comments > 0 ? <Text variant="caption">💬 {card.counts.comments}</Text> : null}
        {card.counts.attachments > 0 ? <Text variant="caption">📎 {card.counts.attachments}</Text> : null}
        {card.assignees.length > 0 ? (
          <View style={styles.assignees}>
            {card.assignees.slice(0, 3).map((a, i) => (
              <View key={a.userId} style={{ marginLeft: i === 0 ? 0 : -4 }}>
                <Initials name={a.name} size={20} background={colors.surface} />
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: 10,
    minHeight: 48,
  },
  labels: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 6 },
  labelBar: { height: 6, width: 32, borderRadius: radius.pill },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 8, rowGap: 4, marginTop: 8 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  assignees: { flexDirection: "row", marginLeft: "auto" },
});
