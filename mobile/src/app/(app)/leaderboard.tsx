// Global Leaderboard — the web's /leaderboard: ranked artists (50 per page,
// loaded as you scroll), "Share #N", and the reward-code box (POST /api/coupons/redeem).
// Data: GET /api/mobile/leaderboard?page=N.

import { useCallback, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { get } from "@/api/client";
import { errorMessage } from "@/api/errors";
import { ShareToSkool } from "@/components/ShareToSkool";
import { Button, Card, EmptyState, ErrorState, Field, Icon, LoadingState, PageHeader, ScreenSkeleton, Text } from "@/components/ui";
import { useApiMutation } from "@/hooks/useApi";
import { colors, radius } from "@/theme/tokens";
import type { LeaderboardResponse, LeaderboardRow, SharePayload } from "@/types/api";

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
    <Card style={{ gap: 10 }}>
      <Text variant="label" accessibilityRole="header">Have a reward code?</Text>
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
        <Button title="Redeem" loading={redeem.isPending} disabled={!code} onPress={submit} />
      </View>
      {msg ? (
        <Text variant="small" color={msg.ok ? colors.success : colors.brand2} accessibilityLiveRegion="polite">
          {msg.text}
        </Text>
      ) : null}
    </Card>
  );
}

function Row({ r }: { r: LeaderboardRow }) {
  return (
    <View
      style={[s.row, r.isMe && { backgroundColor: colors.surface2, borderColor: colors.brand }]}
      accessible
      accessibilityLabel={`Rank ${r.rank}, ${r.stageName}${r.isMe ? " (you)" : ""}${r.countryCode ? `, ${r.countryCode}` : ""}. ${r.totalXp} XP, quiz ${r.avgQuiz || "none"}, ${r.streak} day streak`}
    >
      <Icon name="trophy" size={17} color={r.rank <= 3 ? colors.warning : colors.muted} />
      <Text weight="semibold" style={s.rank}>{r.rank}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} weight={r.isMe ? "semibold" : undefined}>
          {r.stageName}
          {r.isMe ? <Text variant="caption" color={colors.accent}> (you)</Text> : null}
          {r.countryCode ? <Text variant="caption"> · {r.countryCode}</Text> : null}
        </Text>
        <Text variant="caption">
          {r.totalXp} XP · Quiz {r.avgQuiz || "—"} · 🔥 {r.streak}
        </Text>
      </View>
    </View>
  );
}

function Header({ me, share }: { me: LeaderboardRow | null; share: SharePayload | null }) {
  return (
    <View style={{ gap: 16, paddingBottom: 12 }}>
      <PageHeader
        title="Global Leaderboard"
        subtitle={"Ranked by a blend of XP, quiz & assignment quality, speed, and consistency.\nTop 1000 each period qualify for subscription discounts and rewards."}
      />
      {me ? (
        <Card style={{ gap: 10 }}>
          <Text variant="label">Your position</Text>
          <Row r={me} />
          {share ? <ShareToSkool share={share} label={`Share #${me.rank}`} /> : null}
        </Card>
      ) : null}
      <RedeemBox />
    </View>
  );
}

export default function Leaderboard() {
  const insets = useSafeAreaInsets();
  const query = useInfiniteQuery({
    queryKey: [PATH, "infinite"],
    queryFn: ({ pageParam }) => get<LeaderboardResponse>(PATH, { page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasNext ? last.page + 1 : undefined),
  });
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [query]);

  const first = query.data?.pages[0];
  const rows = query.data?.pages.flatMap((p) => p.rows) ?? [];

  let body: React.ReactNode;
  if (!first) {
    body = query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : <ScreenSkeleton rows={6} />;
  } else {
    body = (
      <FlashList
        data={rows}
        keyExtractor={(r) => r.userId}
        renderItem={({ item }) => <Row r={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListHeaderComponent={<Header me={first.me} share={first.share} />}
        ListEmptyComponent={<EmptyState icon="trophy" title="No artists ranked yet." />}
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <LoadingState />
          ) : query.isFetchNextPageError ? (
            <Button title="Load more" variant="ghost" style={{ alignSelf: "center", marginTop: 12 }} onPress={() => void query.fetchNextPage()} />
          ) : null
        }
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage && !query.isFetchNextPageError) void query.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
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
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 56,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rank: { minWidth: 32, fontVariant: ["tabular-nums"] },
});
