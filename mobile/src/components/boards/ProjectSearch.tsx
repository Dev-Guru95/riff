// Global project search (the web's GlobalSearch): GET /api/search?q= across
// boards, cards, labels, comments, attachments and people, scoped server-side
// to the boards the user belongs to. Results are grouped like the web dropdown.

import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, type Href } from "expo-router";

import { Card, Field, Text } from "@/components/ui";
import { errorMessage } from "@/api/errors";
import { useApiQuery } from "@/hooks/useApi";
import { colors, radius, TOUCH } from "@/theme/tokens";
import type { SearchResponse } from "@/types/boards";
import { Initials } from "./bits";
import { labelColor } from "./utils";

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text variant="caption" style={styles.groupLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Row({ href, icon, sub, title }: { href: string; icon: React.ReactNode; sub?: string; title: string }) {
  return (
    <Pressable
      onPress={() => router.push(href as Href)}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${title}, ${sub}` : title}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface2 }]}
    >
      <View style={styles.icon}>{icon}</View>
      <Text style={{ flex: 1, minWidth: 0 }} numberOfLines={1}>{title}</Text>
      {sub ? <Text variant="caption" numberOfLines={1} style={{ maxWidth: 112 }}>{sub}</Text> : null}
    </Pressable>
  );
}

const Emoji = ({ e }: { e: string }) => <Text>{e}</Text>;

export function ProjectSearch() {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const enabled = term.length >= 2 && q.trim().length >= 2;
  const query = useApiQuery<SearchResponse>("/api/search", { q: term }, { enabled });
  const r = query.data?.results;
  const total = r ? r.boards.length + r.cards.length + r.labels.length + r.comments.length + r.attachments.length + r.users.length : 0;

  return (
    <View style={{ gap: 4 }}>
      <Field
        value={q}
        onChangeText={setQ}
        placeholder="Search boards, tasks, labels, comments, people…"
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
        accessibilityLabel="Search projects"
      />
      {enabled ? (
        <Card padded={false} style={{ padding: 8 }}>
          {query.isLoading && total === 0 ? (
            <Text variant="caption" style={{ padding: 8 }}>Searching…</Text>
          ) : query.isError && !r ? (
            <Text variant="caption" style={{ padding: 8 }}>{errorMessage(query.error)}</Text>
          ) : !r || total === 0 ? (
            <Text variant="caption" style={{ padding: 8 }}>No matches for “{term}”.</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {r.boards.length > 0 ? (
                <Group label="Boards">
                  {r.boards.map((b) => <Row key={b.id} href={`/boards/${b.id}`} icon={<Emoji e="🗂️" />} title={b.title} />)}
                </Group>
              ) : null}
              {r.cards.length > 0 ? (
                <Group label="Tasks">
                  {r.cards.map((c) => (
                    <Row key={c.id} href={`/boards/${c.boardId}?card=${c.id}`} icon={<Emoji e="🗒️" />} sub={c.boardTitle} title={c.title} />
                  ))}
                </Group>
              ) : null}
              {r.labels.length > 0 ? (
                <Group label="Labels">
                  {r.labels.map((l) => (
                    <Row
                      key={l.id}
                      href={`/boards/${l.boardId}`}
                      icon={<View style={[styles.labelBar, { backgroundColor: labelColor(l.color) }]} />}
                      sub={l.boardTitle}
                      title={l.name || l.color}
                    />
                  ))}
                </Group>
              ) : null}
              {r.comments.length > 0 ? (
                <Group label="Comments">
                  {r.comments.map((c, i) => (
                    <Row key={`${c.cardId}-${i}`} href={`/boards/${c.boardId}?card=${c.cardId}`} icon={<Emoji e="💬" />} sub={c.boardTitle} title={c.snippet} />
                  ))}
                </Group>
              ) : null}
              {r.attachments.length > 0 ? (
                <Group label="Attachments">
                  {r.attachments.map((a, i) => (
                    <Row key={`${a.cardId}-${i}`} href={`/boards/${a.boardId}?card=${a.cardId}`} icon={<Emoji e="📎" />} sub={a.boardTitle} title={a.name} />
                  ))}
                </Group>
              ) : null}
              {r.users.length > 0 ? (
                <Group label="People">
                  {r.users.map((u) => (
                    <View key={u.userId} style={[styles.row, { minHeight: 36 }]}>
                      <View style={styles.icon}><Initials name={u.name} size={20} /></View>
                      <Text style={{ flex: 1, minWidth: 0 }} numberOfLines={1}>{u.name}</Text>
                      <Text variant="caption" numberOfLines={1} style={{ maxWidth: 140 }}>{u.email}</Text>
                    </View>
                  ))}
                </Group>
              ) : null}
            </View>
          )}
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  groupLabel: { fontSize: 10, lineHeight: 14, textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: 8, marginBottom: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, minHeight: TOUCH, borderRadius: radius.md },
  icon: { width: 24, alignItems: "center" },
  labelBar: { height: 12, width: 24, borderRadius: radius.pill },
});
