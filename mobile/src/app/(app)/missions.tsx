// Weekly Missions — the web's /missions: this week's challenges, each completed
// via POST /api/missions/:id/complete with proof of what you actually did.
// Data: GET /api/mobile/missions (creates the week's set on first visit, as the page does).

import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack, router } from "expo-router";

import { Button, Card, Field, QueryView, Screen, Text } from "@/components/ui";
import { useApiMutation, useApiQuery, useInvalidate } from "@/hooks/useApi";
import { colors, radius } from "@/theme/tokens";
import type { MissionItem, MissionsResponse } from "@/types/api";

const CATEGORY_ICON: Record<string, string> = { branding: "🎨", content: "📸", engagement: "💬", release: "🚀" };

/** Matches MISSION_PROOF_MIN / _MAX on the server. */
const PROOF_MIN = 10;
const PROOF_MAX = 500;

function MissionCard({ mission, locked }: { mission: MissionItem; locked: boolean }) {
  const invalidate = useInvalidate();
  const later = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (later.current) clearTimeout(later.current);
  }, []);
  const [note, setNote] = useState<string | null>(null);
  // Collapsed until the artist says they've done the work, so the list stays a list.
  const [proving, setProving] = useState(false);
  const [proof, setProof] = useState("");
  const done = mission.status === "completed";
  const complete = useApiMutation<{ xp?: { awarded: number } | null; streak?: { currentLen: number } | null }>({
    onSuccess: (d) => {
      // Like the web: show the reward inline for a moment, then refresh.
      setNote(`+${d.xp?.awarded ?? mission.xpReward} XP${d.streak?.currentLen ? ` · 🔥 ${d.streak.currentLen}-day streak` : ""}`);
      setProving(false);
      later.current = setTimeout(() => {
        setNote(null);
        void invalidate("/api/mobile/missions", "/api/mobile/dashboard", "/api/mobile/leaderboard");
      }, 1800);
    },
  });

  const tooShort = proof.trim().length < PROOF_MIN;

  return (
    <Card style={{ padding: 20, opacity: done ? 0.7 : 1 }}>
      <View style={styles.row}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.titleRow}>
            <Text style={{ fontSize: 18, lineHeight: 28 }}>{CATEGORY_ICON[mission.category] ?? "🎯"}</Text>
            <Text weight="semibold" style={{ fontSize: 16, lineHeight: 24, flexShrink: 1 }}>{mission.title}</Text>
            <View style={styles.tag}>
              <Text variant="caption">{mission.category}</Text>
            </View>
          </View>
          <Text variant="small">{mission.description}</Text>
          <Text variant="caption" color={colors.accent} style={{ marginTop: 8 }}>+{mission.xpReward} XP</Text>
        </View>

        {done ? (
          <Text weight="medium" color={colors.success}>✓ Done</Text>
        ) : locked ? (
          <View style={styles.tag}>
            <Text variant="caption">🔒 Pro</Text>
          </View>
        ) : !proving ? (
          <Button
            title="I've done this"
            size="sm"
            disabled={!!note}
            onPress={() => setProving(true)}
            accessibilityLabel={`Complete ${mission.title}`}
          />
        ) : null}
      </View>

      {/* Proof. XP, badges and leaderboard points are real, so completing a
          mission asks what you actually did rather than taking your word. */}
      {proving && !done && !locked ? (
        <View style={styles.proof}>
          <Field
            label="What did you do?"
            hint="Paste a link to the post, track or page — or write a sentence or two."
            value={proof}
            onChangeText={setProof}
            multiline
            numberOfLines={3}
            maxLength={PROOF_MAX}
            placeholder="https://instagram.com/p/… or: Rewrote my bio and updated it everywhere."
            error={complete.isError ? "Could not complete this mission. Try again." : null}
          />
          <View style={styles.proofActions}>
            <Button
              title={complete.isPending ? "…" : "Complete mission"}
              size="sm"
              disabled={complete.isPending || tooShort}
              onPress={() => complete.mutate({ path: `/api/missions/${mission.id}/complete`, body: { proof: proof.trim() } })}
            />
            <Button
              title="Cancel"
              size="sm"
              variant="ghost"
              disabled={complete.isPending}
              onPress={() => setProving(false)}
            />
            <Text variant="caption" style={{ marginLeft: "auto" }}>{proof.trim().length}/{PROOF_MAX}</Text>
          </View>
        </View>
      ) : null}

      {done && mission.proof ? (
        <View style={styles.proof}>
          <Text variant="caption">Your proof</Text>
          <Text variant="small" style={{ marginTop: 2 }}>{mission.proof}</Text>
        </View>
      ) : null}

      {note ? <Text weight="semibold" color={colors.success} style={{ marginTop: 12 }}>{note}</Text> : null}
    </Card>
  );
}

export default function Missions() {
  const query = useApiQuery<MissionsResponse>("/api/mobile/missions");
  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: "Missions" }} />
      <QueryView query={query}>
        {(d) => {
          // Older builds of the API omit the flag; treat that as unlocked so
          // this screen never locks everyone out on a stale server.
          const unlocked = d.weeklyMissions !== false;
          return (
            <>
              <View style={{ gap: 4 }}>
                <Text variant="title" accessibilityRole="header">🎯 Weekly Missions</Text>
                <Text variant="small">
                  Real-world challenges that grow your career. Complete them for XP, badges, and leaderboard points.
                  {unlocked ? (
                    <Text variant="small" weight="medium" color={colors.foreground}> {d.completed}/{d.total} done.</Text>
                  ) : null}
                </Text>
              </View>

              {!unlocked ? (
                <Card style={{ padding: 20, marginTop: 8, gap: 8 }}>
                  <Text weight="semibold">🔒 Missions are part of Pro</Text>
                  <Text variant="small">
                    Weekly missions turn what you learn into real career steps, and they count towards your XP, badges
                    and leaderboard rank.
                  </Text>
                  {/* The app sells nothing (App Store 3.1.1), so this points at
                      the plan comparison rather than a purchase flow. */}
                  <Button title="See plans" size="sm" variant="ghost" onPress={() => router.push("/pricing")} />
                </Card>
              ) : null}

              <View style={{ gap: 12, marginTop: 8 }}>
                {d.missions.map((m) => (
                  <MissionCard key={m.id} mission={m} locked={!unlocked} />
                ))}
                {d.missions.length === 0 ? <Text variant="small">No active missions right now. Check back soon!</Text> : null}
              </View>
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16 },
  titleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.surface2 },
  proof: { marginTop: 16, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 8 },
  proofActions: { flexDirection: "row", alignItems: "center", gap: 8 },
});
