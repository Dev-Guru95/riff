// Global Leaderboard — the web's /leaderboard: header with "Share #N", the
// ranked table (50 per page, ← Prev / Page N / Next →) and the reward-code box
// (POST /api/coupons/redeem).
// Data: GET /api/mobile/leaderboard?page=N.

import { useCallback, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { errorMessage } from "@/api/errors";
import { SectionLabel } from "@/components/learning/Stat";
import { ShareToSkool } from "@/components/ShareToSkool";
import { Button, Card, ErrorState, Field, Icon, PageHeader, ScreenSkeleton, Text } from "@/components/ui";
import { useApiMutation, useApiQuery } from "@/hooks/useApi";
import { colors, fonts, radius } from "@/theme/tokens";
import type { LeaderboardResponse, LeaderboardRow } from "@/types/api";

const PATH = "/api/mobile/leaderboard";

type RedeemResult = { code: string; type: string; value: number; description: string };

function RedeemBox() {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const redeem = useApiMutation<RedeemResult>({
    onSuccess: (d) => {
      setMsg({ ok: true, text: `Redeemed ${d.code} — ${d.type === "percent" ? `${d.value}% off` : d.description || "reward applied"}!` });
      setCode("");
    },
  });
  function submit() {
    if (!code || redeem.isPending) return;
    setMsg(null);
    redeem.mutate(
      { path: "/api/coupons/redeem", body: { code } },
      { onError: (e) => setMsg({ ok: false, text: errorMessage(e) || "Could not redeem" }) },
    );
  }
  return (
    <Card style={{ marginTop: 24 }}>
      <View style={{ marginBottom: 8 }}>
        <SectionLabel>Have a reward code?</SectionLabel>
      </View>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Field
            accessibilityLabel="Reward code"
            placeholder="e.g. TOP1000"
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
        </View>
        <Button title="Redeem" disabled={!code || redeem.isPending} onPress={submit} />
      </View>
      {msg ? (
        <Text color={msg.ok ? colors.success : colors.brand2} style={{ marginTop: 8 }} accessibilityLiveRegion="polite">
          {msg.text}
        </Text>
      ) : null}
    </Card>
  );
}

/**
 * The table's column layout, shared by the header and the rows so they line up.
 * The web table scrolls sideways at phone width; here its Rank (trophy) and
 * Position columns share one "Rank" column so every column fits the screen.
 */
function Cols({ cells }: { cells: React.ReactNode[] }) {
  return (
    <View style={s.cols}>
      <View style={s.cRank}>{cells[0]}</View>
      <View style={s.cArtist}>{cells[1]}</View>
      <View style={s.cXp}>{cells[2]}</View>
      <View style={s.cQuiz}>{cells[3]}</View>
      <View style={s.cStreak}>{cells[4]}</View>
    </View>
  );
}

function Row({ r, last }: { r: LeaderboardRow; last: boolean }) {
  return (
    <View
      style={[s.side, s.row, r.isMe && { backgroundColor: colors.surface2 }, last ? s.bottom : s.divider]}
      accessible
      accessibilityLabel={`Rank ${r.rank}, ${r.stageName}${r.isMe ? " (you)" : ""}${r.countryCode ? `, ${r.countryCode}` : ""}. ${r.totalXp} XP, quiz ${r.avgQuiz || "none"}, ${r.streak} day streak`}
    >
      <Cols
        cells={[
          <View key="r" style={s.rankCell}>
            <Icon name="trophy" size={17} color={r.rank <= 3 ? colors.warning : colors.muted} />
            <Text weight="semibold" style={s.num} numberOfLines={1}>{r.rank}</Text>
          </View>,
          <Text key="a" numberOfLines={1}>
            <Text weight={r.isMe ? "semibold" : undefined}>{r.stageName}</Text>
            {r.isMe ? <Text variant="caption" color={colors.accent}> (you)</Text> : null}
            {r.countryCode ? <Text variant="caption"> · {r.countryCode}</Text> : null}
          </Text>,
          <Text key="x" style={[s.num, s.right]}>{r.totalXp}</Text>,
          <Text key="q" style={[s.num, s.right]}>{r.avgQuiz || "—"}</Text>,
          <Text key="s" style={[s.num, s.right]}>{r.streak}</Text>,
        ]}
      />
    </View>
  );
}

function Pager({ page, hasNext, onPage }: { page: number; hasNext: boolean; onPage: (p: number) => void }) {
  if (page <= 1 && !hasNext) return null;
  return (
    <View style={s.pager}>
      <Button title="← Prev" variant="ghost" size="sm" disabled={page <= 1} onPress={() => onPage(page - 1)} />
      <Text variant="caption">Page {page}</Text>
      <Button title="Next →" variant="ghost" size="sm" disabled={!hasNext} onPress={() => onPage(page + 1)} />
    </View>
  );
}

export default function Leaderboard() {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(1);
  const query = useApiQuery<LeaderboardResponse>(PATH, { page }, { placeholderData: (prev) => prev });
  const [refreshing, setRefreshing] = useState(false);
  const { refetch } = query;
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const d = query.data;

  let body: React.ReactNode;
  if (!d) {
    body = query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : <ScreenSkeleton rows={6} />;
  } else {
    const rows = d.rows;
    body = (
      <FlashList
        data={rows}
        extraData={rows.length}
        keyExtractor={(r) => r.userId}
        renderItem={({ item, index }) => <Row r={item} last={index === rows.length - 1} />}
        ListHeaderComponent={
          <View>
            <PageHeader
              title="Global Leaderboard"
              subtitle={"Ranked by a blend of XP, quiz & assignment quality, speed, and consistency.\nTop 1000 each period qualify for subscription discounts and rewards."}
            />
            {d.me && d.share ? (
              <View style={{ marginBottom: 24 }}>
                <ShareToSkool share={d.share} label={`Share #${d.me.rank}`} size="sm" variant="ghost" />
              </View>
            ) : (
              <View style={{ height: 16 }} />
            )}
            <View style={[s.side, s.top, s.divider, s.headRow]}>
              <Cols
                cells={[
                  <Text key="r" style={s.head}>Rank</Text>,
                  <Text key="a" style={s.head}>Artist</Text>,
                  <Text key="x" style={[s.head, s.right]}>XP</Text>,
                  <Text key="q" style={[s.head, s.right]}>Quiz</Text>,
                  <Text key="s" style={[s.head, s.right]}>Streak</Text>,
                ]}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={[s.side, s.bottom, s.empty]}>
            <Icon name="trophy" size={40} strokeWidth={1.25} color={colors.muted} />
            <Text variant="small" style={{ marginTop: 12 }}>No artists ranked yet.</Text>
          </View>
        }
        ListFooterComponent={
          <View>
            <View style={{ marginTop: 16 }}>
              <Pager page={d.page} hasNext={d.hasNext} onPage={setPage} />
            </View>
            <RedeemBox />
          </View>
        }
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} progressBackgroundColor={colors.surface} />
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: insets.bottom + 24 }}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: "Leaderboard" }} />
      {body}
      {query.isFetching && query.isPlaceholderData ? (
        <View style={s.busy} accessibilityLiveRegion="polite">
          <Text variant="caption">Loading…</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  // The rows together form one `.card` (TableCard).
  side: { backgroundColor: colors.surface, borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border },
  top: { borderTopWidth: 1, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card },
  bottom: { borderBottomWidth: 1, borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card },
  divider: { borderBottomWidth: 1 },
  headRow: { paddingVertical: 10, paddingHorizontal: 16 },
  row: { paddingVertical: 12, paddingHorizontal: 16 },
  cols: { flexDirection: "row", alignItems: "center", gap: 8 },
  cRank: { width: 64 },
  rankCell: { flexDirection: "row", alignItems: "center", gap: 6 },
  cArtist: { flex: 1, minWidth: 0 },
  cXp: { width: 52 },
  cQuiz: { width: 36 },
  cStreak: { width: 44 },
  head: { fontSize: 12, lineHeight: 16, fontFamily: fonts.medium, color: colors.muted },
  num: { fontVariant: ["tabular-nums"] },
  right: { textAlign: "right" },
  empty: { alignItems: "center", paddingVertical: 64, paddingHorizontal: 16 },
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  busy: { position: "absolute", top: 8, alignSelf: "center", backgroundColor: colors.surface2, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 4 },
});
