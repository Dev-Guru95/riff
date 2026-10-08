// Search — the web's GlobalSearch (boards page) as a full screen.
// Data: GET /api/search?q= (debounced, 2+ characters), scoped server-side to the
// artist's boards. Boards open /boards/[id]; tasks, comments and attachments open
// /boards/[boardId]?card=[cardId].

import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { router, Stack, type Href } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { keepPreviousData } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar, EmptyState, ErrorState, Icon, LoadingState, Text } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { colors, fonts, radius, TOUCH } from "@/theme/tokens";

type Results = {
  boards: { id: string; title: string }[];
  cards: { id: string; boardId: string; title: string; boardTitle: string }[];
  labels: { id: string; boardId: string; name: string; color: string; boardTitle: string }[];
  comments: { cardId: string; boardId: string; snippet: string; boardTitle: string }[];
  attachments: { cardId: string; boardId: string; name: string; boardTitle: string }[];
  users: { userId: string; name: string; email: string }[];
};

const LABEL_COLOR: Record<string, string> = {
  brand: colors.brand,
  "brand-2": colors.brand2,
  accent: colors.accent,
  success: colors.success,
  warning: colors.warning,
  muted: colors.muted,
};

type Item =
  | { kind: "header"; key: string; label: string }
  | { kind: "row"; key: string; title: string; sub?: string; icon: string; labelColor?: string; href: string }
  | { kind: "user"; key: string; name: string; email: string };

function flatten(r: Results): Item[] {
  const out: Item[] = [];
  const group = (label: string, items: Item[]) => {
    if (!items.length) return;
    out.push({ kind: "header", key: `h-${label}`, label }, ...items);
  };
  group("Boards", r.boards.map((b) => ({ kind: "row", key: `b-${b.id}`, title: b.title, icon: "🗂️", href: `/boards/${b.id}` })));
  group(
    "Tasks",
    r.cards.map((c) => ({ kind: "row", key: `c-${c.id}`, title: c.title, sub: c.boardTitle, icon: "🗒️", href: `/boards/${c.boardId}?card=${c.id}` })),
  );
  group(
    "Labels",
    r.labels.map((l) => ({
      kind: "row",
      key: `l-${l.id}`,
      title: l.name || l.color,
      sub: l.boardTitle,
      icon: "",
      labelColor: LABEL_COLOR[l.color] ?? colors.muted,
      href: `/boards/${l.boardId}`,
    })),
  );
  group(
    "Comments",
    r.comments.map((c, i) => ({ kind: "row", key: `m-${c.cardId}-${i}`, title: c.snippet, sub: c.boardTitle, icon: "💬", href: `/boards/${c.boardId}?card=${c.cardId}` })),
  );
  group(
    "Attachments",
    r.attachments.map((a, i) => ({ kind: "row", key: `a-${a.cardId}-${i}`, title: a.name, sub: a.boardTitle, icon: "📎", href: `/boards/${a.boardId}?card=${a.cardId}` })),
  );
  group("People", r.users.map((u) => ({ kind: "user", key: `u-${u.userId}`, name: u.name, email: u.email })));
  return out;
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function Search() {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const term = useDebounced(q.trim(), 250);
  const enabled = term.length >= 2;
  const query = useApiQuery<{ results: Results }>(enabled ? "/api/search" : null, { q: term }, { placeholderData: keepPreviousData });
  const items = useMemo(() => (query.data && enabled ? flatten(query.data.results) : []), [query.data, enabled]);

  let body: React.ReactNode;
  if (!enabled) {
    body = <EmptyState icon="search" title="Search your projects" body="Find boards, tasks, labels, comments, attachments and people. Type at least 2 characters." />;
  } else if (query.isError && !query.data) {
    body = <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  } else if (!query.data) {
    body = <LoadingState label="Searching…" />;
  } else if (items.length === 0) {
    body = <EmptyState icon="search" title={`No matches for “${term}”.`} />;
  } else {
    body = (
      <FlashList
        data={items}
        keyExtractor={(i) => i.key}
        getItemType={(i) => i.kind}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        renderItem={({ item }) => {
          if (item.kind === "header") return <Text variant="label" style={styles.header}>{item.label}</Text>;
          if (item.kind === "user")
            return (
              <View style={styles.row}>
                <Avatar name={item.name} size={28} />
                <Text style={{ flex: 1 }} numberOfLines={1}>{item.name}</Text>
                <Text variant="caption" numberOfLines={1} style={{ maxWidth: "45%" }}>{item.email}</Text>
              </View>
            );
          return (
            <Pressable
              onPress={() => router.push(item.href as Href)}
              accessibilityRole="button"
              accessibilityLabel={item.sub ? `${item.title}, in ${item.sub}` : item.title}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface2 }]}
            >
              <View style={styles.icon}>
                {item.labelColor ? <View style={[styles.labelSwatch, { backgroundColor: item.labelColor }]} /> : <Text>{item.icon}</Text>}
              </View>
              <Text style={{ flex: 1 }} numberOfLines={2}>{item.title}</Text>
              {item.sub ? <Text variant="caption" numberOfLines={1} style={{ maxWidth: "35%" }}>{item.sub}</Text> : null}
              <Icon name="chevronRight" size={14} color={colors.muted} />
            </Pressable>
          );
        }}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: "Search" }} />
      <View style={styles.searchWrap}>
        <Icon name="search" size={18} color={colors.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          autoFocus
          placeholder="Search boards, tasks, labels, comments, people…"
          placeholderTextColor={colors.muted}
          selectionColor={colors.brand}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={styles.input}
          accessibilityLabel="Search"
        />
        {query.isFetching && enabled ? <Text variant="caption">…</Text> : null}
        {q ? (
          <Pressable onPress={() => setQ("")} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} style={styles.clear}>
            <Icon name="close" size={16} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 16,
    paddingHorizontal: 12,
    minHeight: TOUCH,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.field,
  },
  input: { flex: 1, fontSize: 16, fontFamily: fonts.regular, color: colors.foreground, paddingVertical: 10 },
  clear: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  header: { marginTop: 12, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: TOUCH, paddingHorizontal: 8, borderRadius: radius.md },
  icon: { width: 24, alignItems: "center" },
  labelSwatch: { width: 24, height: 12, borderRadius: radius.pill },
});
