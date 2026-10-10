// One Kanban column as a phone-width page: header (title, count, actions),
// a vertical FlashList of cards with pull-to-refresh and "Load more", and the
// add-card composer pinned to the bottom.

import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { FlashList } from "@shopify/flash-list";

import { Button, Icon, Text } from "@/components/ui";
import { colors, fonts, radius, TOUCH } from "@/theme/tokens";
import type { BoardCardDTO } from "@/types/boards";
import { CardTile } from "./CardTile";

export type ColumnView = { id: string; title: string; cardTotal: number; cards: BoardCardDTO[] };

export function BoardColumn({
  column,
  cards,
  width,
  height,
  filterActive,
  canEdit,
  canManage,
  loadingMore,
  refreshing,
  onRefresh,
  onLoadMore,
  onOpenCard,
  onCardMenu,
  onColumnMenu,
  onRename,
  onAddCard,
}: {
  column: ColumnView;
  /** Cards to show (already filtered when a filter is active). */
  cards: BoardCardDTO[];
  width: number;
  height: number;
  filterActive: boolean;
  canEdit: boolean;
  canManage: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
  onOpenCard: (card: BoardCardDTO) => void;
  onCardMenu?: (card: BoardCardDTO) => void;
  onColumnMenu: () => void;
  onRename: () => void;
  onAddCard: (title: string) => Promise<boolean>;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const remaining = column.cardTotal - column.cards.length;

  async function submit() {
    if (saving) return;
    const t = title.trim();
    if (!t) {
      setAdding(false);
      return;
    }
    setSaving(true);
    const ok = await onAddCard(t);
    setSaving(false);
    if (ok) setTitle(""); // stay open for quick entry, like the web
  }

  return (
    <View style={[styles.column, { width, height }]}>
      <View style={styles.head}>
        <Pressable
          onPress={canManage ? onRename : undefined}
          disabled={!canManage}
          accessibilityRole={canManage ? "button" : "header"}
          accessibilityHint={canManage ? "Rename column" : undefined}
          style={{ flex: 1, minHeight: TOUCH, justifyContent: "center" }}
        >
          <Text weight="semibold" numberOfLines={1}>{column.title}</Text>
        </Pressable>
        <Text variant="caption">{filterActive ? `${cards.length} match` : column.cardTotal}</Text>
        {canManage ? (
          <Pressable onPress={onColumnMenu} accessibilityRole="button" accessibilityLabel={`${column.title} column actions`} hitSlop={4} style={styles.iconBtn}>
            <Icon name="more" size={18} color={colors.muted} />
          </Pressable>
        ) : (
          <View style={{ width: 10 }} />
        )}
      </View>

      <FlashList
        data={cards}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <CardTile card={item} onPress={() => onOpenCard(item)} onLongPress={onCardMenu ? () => onCardMenu(item) : undefined} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        contentContainerStyle={{ padding: 8 }}
        refreshing={refreshing}
        onRefresh={onRefresh}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text variant="caption" style={{ textAlign: "center", paddingVertical: 24 }}>
            {filterActive ? "No matches" : "No cards"}
          </Text>
        }
        ListFooterComponent={
          !filterActive && remaining > 0 ? (
            <Button
              title={loadingMore ? "Loading…" : `Load ${remaining} more`}
              variant="link"
              size="sm"
              loading={loadingMore}
              onPress={onLoadMore}
              style={{ alignSelf: "center", marginTop: 8 }}
            />
          ) : null
        }
      />

      {canEdit && !filterActive ? (
        adding ? (
          <View style={styles.composer}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              autoFocus
              multiline
              numberOfLines={2}
              placeholder="Card title…"
              placeholderTextColor={colors.muted}
              selectionColor={colors.brand}
              maxLength={300}
              returnKeyType="done"
              submitBehavior="submit"
              onSubmitEditing={() => void submit()}
              style={styles.input}
              accessibilityLabel={`New card in ${column.title}`}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title="Add" size="sm" onPress={() => void submit()} loading={saving} />
              <Button
                title="Cancel"
                size="sm"
                variant="ghost"
                onPress={() => {
                  setAdding(false);
                  setTitle("");
                }}
              />
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => setAdding(true)}
            accessibilityRole="button"
            accessibilityLabel={`Add card to ${column.title}`}
            style={({ pressed }) => [styles.addBtn, pressed && { backgroundColor: colors.border }]}
          >
            <View style={styles.plus}>
              <Icon name="plus" size={10} strokeWidth={2.5} color={colors.foreground} />
            </View>
            <Text variant="small">Add card</Text>
          </Pressable>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    overflow: "hidden",
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 14,
    paddingRight: 4,
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBtn: { width: TOUCH, height: TOUCH, alignItems: "center", justifyContent: "center" },
  composer: { padding: 8, gap: 8, borderTopWidth: 1, borderTopColor: colors.border },
  input: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: radius.field,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.foreground,
    minHeight: 64,
    textAlignVertical: "top",
  },
  plus: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.border, alignItems: "center", justifyContent: "center" },
  addBtn: {
    margin: 8,
    minHeight: TOUCH,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radius.field,
    backgroundColor: colors.surface2,
  },
});
