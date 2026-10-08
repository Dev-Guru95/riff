// "New board": the web's template picker (BoardsClient) → POST /api/boards
// { title, kind }, then opens the new board.

import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, type Href } from "expo-router";

import { Button, Field, Text } from "@/components/ui";
import { colors, radius } from "@/theme/tokens";
import { Sheet } from "./Sheet";
import { useBoardAction } from "./useBoardAction";
import { BOARD_TEMPLATES, templateFor } from "./utils";

export function CreateBoardSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { run, busy } = useBoardAction();
  const [kind, setKind] = useState("generic");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  function close() {
    setKind("generic");
    setTitle("");
    setError(null);
    onClose();
  }

  async function create() {
    const t = title.trim();
    if (!t) {
      setError("Give the board a name");
      return;
    }
    setError(null);
    const res = await run<{ id: string }>("/api/boards", { body: { title: t, kind }, invalidates: ["/api/boards"], alertErrors: true });
    if (res?.id) {
      close();
      setTimeout(() => router.push(`/boards/${res.id}` as Href), 350);
    }
  }

  return (
    <Sheet visible={visible} onClose={close} title="Start a new board">
      <Text variant="small">Pick a tool — each comes pre-set with the right columns and labels.</Text>
      <View style={styles.grid} accessibilityRole="radiogroup">
        {BOARD_TEMPLATES.map((t) => {
          const on = kind === t.kind;
          return (
            <Pressable
              key={t.kind}
              onPress={() => {
                setKind(t.kind);
                setTitle(t.kind === "generic" ? "" : t.name);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${t.name}. ${t.tagline}`}
              style={({ pressed }) => [styles.tile, on && styles.tileOn, pressed && { transform: [{ scale: 0.98 }] }]}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ fontSize: 22 }}>{t.icon}</Text>
                {t.track ? (
                  <View style={styles.track}>
                    <Text variant="caption" style={{ fontSize: 10, lineHeight: 14 }}>Track {t.track}</Text>
                  </View>
                ) : null}
              </View>
              <Text weight="medium">{t.name}</Text>
              <Text variant="caption" numberOfLines={2}>{t.tagline}</Text>
            </Pressable>
          );
        })}
      </View>
      <Field
        label="Board name"
        value={title}
        onChangeText={setTitle}
        maxLength={120}
        placeholder="Board name"
        error={error}
        returnKeyType="done"
        onSubmitEditing={() => void create()}
      />
      <Button title={`Create ${templateFor(kind).name}`} onPress={() => void create()} loading={busy} fullWidth />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "48%",
    flexGrow: 1,
    gap: 4,
    padding: 12,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 112,
  },
  tileOn: { borderColor: colors.brand, backgroundColor: colors.surface2 },
  track: { marginLeft: "auto", paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.pill, backgroundColor: colors.surface2 },
});
