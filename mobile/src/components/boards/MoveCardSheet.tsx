// "Move to…": the touch replacement for the web's drag-and-drop. Step 1 picks
// the column, step 2 the position, then POST /api/cards/[id]/move
// { toColumnId, toIndex }. The server re-sequences both columns, and toIndex
// counts positions in the destination column *without* the moving card.

import { useState } from "react";
import { View } from "react-native";

import { Button, Card, ListRow, Text } from "@/components/ui";
import { colors } from "@/theme/tokens";
import type { BoardDTO } from "@/types/boards";
import { Sheet } from "./Sheet";

type Column = Pick<BoardDTO["columns"][number], "id" | "title" | "cardTotal"> & { cards: { id: string; title: string }[] };

export function MoveCardSheet({
  visible,
  card,
  columns,
  onClose,
  onMove,
}: {
  visible: boolean;
  card: { id: string; title: string; columnId: string } | null;
  columns: Column[];
  onClose: () => void;
  onMove: (toColumnId: string, toIndex: number) => void;
}) {
  const [columnId, setColumnId] = useState<string | null>(null);
  const target = columns.find((c) => c.id === columnId) ?? null;

  const close = () => {
    setColumnId(null);
    onClose();
  };
  const move = (toIndex: number) => {
    if (!target) return;
    onMove(target.id, toIndex);
    close();
  };

  const others = target ? target.cards.filter((c) => c.id !== card?.id) : [];
  const unloaded = target ? target.cardTotal - target.cards.length : 0;
  // Index of the card in its own column, to mark "current position".
  const currentIdx = target && card && target.id === card.columnId ? target.cards.findIndex((c) => c.id === card.id) : -1;

  return (
    <Sheet visible={visible} onClose={close} title={target ? `Move to ${target.title}` : "Move card"}>
      {card ? <Text variant="small" numberOfLines={2}>“{card.title}”</Text> : null}
      {!target ? (
        <Card padded={false} style={{ overflow: "hidden" }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <Text variant="label">Choose a column</Text>
          </View>
          {columns.map((c) => (
            <ListRow
              key={c.id}
              icon="kanban"
              title={c.title}
              subtitle={`${c.cardTotal} card${c.cardTotal === 1 ? "" : "s"}${c.id === card?.columnId ? " · current column" : ""}`}
              onPress={() => setColumnId(c.id)}
            />
          ))}
        </Card>
      ) : (
        <>
          <Card padded={false} style={{ overflow: "hidden" }}>
            <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
              <Text variant="label">Choose a position</Text>
            </View>
            <ListRow icon="chevronDown" title="Top of the list" onPress={() => move(0)} />
            {others.map((c, i) => (
              <ListRow
                key={c.id}
                title={`After “${c.title}”`}
                subtitle={currentIdx === i + 1 ? "Current position" : undefined}
                onPress={() => move(i + 1)}
              />
            ))}
            <ListRow
              icon="chevronDown"
              title="Bottom of the list"
              subtitle={unloaded > 0 ? `After all ${target.cardTotal} cards` : undefined}
              onPress={() => move(Math.max(target.cardTotal, others.length))}
            />
          </Card>
          <Button title="Back to columns" variant="ghost" icon="chevronLeft" onPress={() => setColumnId(null)} />
          {unloaded > 0 ? (
            <Text variant="caption" color={colors.muted}>
              Only the first {target.cards.length} cards of this column are listed.
            </Text>
          ) : null}
        </>
      )}
    </Sheet>
  );
}
