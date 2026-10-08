// Global project search (the web's GlobalSearch): GET /api/search?q= across
// boards, cards, labels, comments, attachments and people, scoped server-side
// to the boards the user belongs to.

import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, type Href } from "expo-router";

import { Card, Field, Icon, Skeleton, Text, type IconName } from "@/components/ui";
import { errorMessage } from "@/api/errors";
import { useApiQuery } from "@/hooks/useApi";
import { colors } from "@/theme/tokens";
import type { SearchResponse } from "@/types/boards";
import { labelColor } from "./utils";

type Row = { key: string; icon: IconName; title: string; subtitle: string; href?: string; dot?: string };

export function ProjectSearch() {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const enabled = term.length >= 2;
  const query = useApiQuery<SearchResponse>("/api/search", { q: term }, { enabled });
  const r = query.data?.results;

  const rows: Row[] = r
    ? [
        ...r.boards.map((b) => ({ key: `b${b.id}`, icon: "kanban" as const, title: b.title, subtitle: "Board", href: `/boards/${b.id}` })),
        ...r.cards.map((c) => ({ key: `c${c.id}`, icon: "card" as const, title: c.title, subtitle: `Card · ${c.boardTitle}`, href: `/boards/card/${c.id}` })),
        ...r.labels.map((l) => ({ key: `l${l.id}`, icon: "flag" as const, title: l.name || l.color, subtitle: `Label · ${l.boardTitle}`, href: `/boards/${l.boardId}`, dot: labelColor(l.color) })),
        ...r.comments.map((c, i) => ({ key: `m${c.cardId}${i}`, icon: "chat" as const, title: c.snippet, subtitle: `Comment · ${c.boardTitle}`, href: `/boards/card/${c.cardId}` })),
        ...r.attachments.map((a, i) => ({ key: `a${a.cardId}${i}`, icon: "clipboard" as const, title: a.name, subtitle: `Attachment · ${a.boardTitle}`, href: `/boards/card/${a.cardId}` })),
        ...r.users.map((u) => ({ key: `u${u.userId}`, icon: "user" as const, title: u.name, subtitle: u.email ? `Person · ${u.email}` : "Person" })),
      ]
    : [];

  return (
    <View style={{ gap: 8 }}>
      <Field
        value={q}
        onChangeText={setQ}
        placeholder="Search boards, tasks, labels, comments, people…"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
        accessibilityLabel="Search projects"
      />
      {enabled ? (
        <Card padded={false} style={{ overflow: "hidden" }}>
          {query.isLoading ? (
            <View style={{ padding: 12, gap: 8 }}>
              <Skeleton height={36} />
              <Skeleton height={36} />
            </View>
          ) : query.isError ? (
            <Text variant="small" style={{ padding: 16 }}>{errorMessage(query.error)}</Text>
          ) : rows.length === 0 ? (
            <Text variant="small" style={{ padding: 16 }}>No results for “{term}”.</Text>
          ) : (
            rows.slice(0, 30).map((row) => (
              <Pressable
                key={row.key}
                disabled={!row.href}
                onPress={() => row.href && router.push(row.href as Href)}
                accessibilityRole={row.href ? "button" : undefined}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface2 }]}
              >
                {row.dot ? <View style={[styles.dot, { backgroundColor: row.dot }]} /> : <Icon name={row.icon} size={18} color={colors.muted} />}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1}>{row.title}</Text>
                  <Text variant="caption" numberOfLines={1}>{row.subtitle}</Text>
                </View>
                {row.href ? <Icon name="chevronRight" size={16} color={colors.muted} /> : null}
              </Pressable>
            ))
          )}
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, minHeight: 52 },
  dot: { width: 18, height: 18, borderRadius: 9 },
});
