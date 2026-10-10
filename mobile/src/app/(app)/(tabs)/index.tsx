// Home — the web's /dashboard (src/app/(app)/dashboard/page.tsx) at phone width.
// Data: GET /api/mobile/dashboard (same computations as the web page).

import { Pressable, StyleSheet, View } from "react-native";
import { router, type Href } from "expo-router";

import { BadgeImage } from "@/components/BadgeImage";
import { ShareToSkool } from "@/components/ShareToSkool";
import { GoalRow, SectionLabel, Stat } from "@/components/learning/Stat";
import { Button, Card, ProgressBar, ProgressRing, QueryView, Screen, Text } from "@/components/ui";
import { useRefetchOnFocus } from "@/components/learning/useRefetchOnFocus";
import { useApiQuery } from "@/hooks/useApi";
import { colors, fonts, radius } from "@/theme/tokens";
import type { DashboardResponse } from "@/types/api";

const TOOLKIT = [
  { href: "/coach", icon: "🤖", title: "AI Coach", body: "Personalized mentor" },
  { href: "/missions", icon: "🎯", title: "Missions", body: "Weekly challenges" },
  { href: "/audit", icon: "📈", title: "Social Audit", body: "Track real growth" },
  { href: "/roadmap", icon: "🧭", title: "Roadmap", body: "30/90-day plans" },
  { href: "/community", icon: "🤝", title: "Community", body: "Join on Skool" },
  { href: "/leaderboard", icon: "🏆", title: "Leaderboard", body: "Global ranks" },
  { href: "/certificates", icon: "🎓", title: "Certificates", body: "Your credentials" },
] as const;

const rank = (n: number | null | undefined) => (n ? `#${n}` : "—");

export default function Dashboard() {
  const query = useApiQuery<DashboardResponse>("/api/mobile/dashboard");
  useRefetchOnFocus(query.refetch);

  return (
    <Screen onRefresh={query.refetch} contentStyle={{ gap: 24 }}>
      <QueryView query={query}>
        {(d) => {
          const lvl = d.level;
          const program = d.program;
          return (
            <>
              {/* Header */}
              <View style={styles.header}>
                <View>
                  <Text variant="title">Hey {d.stageName ?? "artist"} 👋</Text>
                  <Text variant="small">
                    Level {lvl.levelNumber} ·{" "}
                    <Text variant="small" weight="medium" color={colors.brand}>
                      {lvl.levelName}
                    </Text>
                  </Text>
                </View>
                <View style={styles.headerRight}>
                  <ProgressRing pct={lvl.progressPct} label={`${lvl.totalXp} XP`} size={72} />
                  <View style={{ gap: 8, flexShrink: 1 }}>
                    <Text variant="caption" style={{ maxWidth: 140 }}>
                      {lvl.isMax ? "Max level reached!" : `${lvl.xpToNextLevel} XP to ${lvl.nextLevelName}`}
                    </Text>
                    <ShareToSkool share={d.shares.level} label="Share progress" size="sm" variant="ghost" />
                  </View>
                </View>
              </View>

              {/* Stats: grid-cols-2 */}
              <View style={{ gap: 12 }}>
                <View style={styles.row}>
                  <Stat icon="🔥" value={d.streak.currentLen} label="Day streak" />
                  <Stat icon="⚡" value={lvl.totalXp} label="Total XP" />
                </View>
                <View style={styles.row}>
                  <Stat icon="🏅" value={d.badgesEarned} label="Badges" />
                  <Stat icon="🏆" value={rank(d.ranks?.globalRank)} label="Global rank" />
                </View>
              </View>

              {/* Next best action */}
              <Card style={styles.cardP6}>
                <View style={{ marginBottom: 12 }}>
                  <SectionLabel>Your next move</SectionLabel>
                </View>
                {d.nextLesson ? (
                  <View style={{ gap: 16 }}>
                    <View>
                      <Text variant="caption" color={colors.accent}>{d.nextLesson.courseTitle}</Text>
                      <Text style={styles.lg}>{d.nextLesson.title}</Text>
                      <View style={{ marginTop: 8, width: 224, maxWidth: "100%" }}>
                        <ProgressBar pct={d.courseProgress} />
                      </View>
                      <Text variant="caption" style={{ marginTop: 4 }}>{d.courseProgress}% of course complete</Text>
                    </View>
                    <Button
                      title="Continue →"
                      onPress={() => router.push(`/learn/${d.nextLesson!.id}` as Href)}
                    />
                  </View>
                ) : d.enrollment ? (
                  <View style={styles.between}>
                    <Text color={colors.success} weight="medium" style={{ flex: 1 }}>
                      🎉 Course complete! Explore more courses.
                    </Text>
                    <Button title="Browse courses" variant="ghost" onPress={() => router.push("/courses")} />
                  </View>
                ) : (
                  <Button title="Enroll in a course" onPress={() => router.push("/courses")} />
                )}
              </Card>

              {/* Daily & weekly goals */}
              <Card style={styles.cardP6}>
                <View style={[styles.between, { marginBottom: 16 }]}>
                  <SectionLabel>Your goals</SectionLabel>
                  <Text variant="caption">Resets daily · weekly</Text>
                </View>
                <View style={{ gap: 12 }}>
                  <GoalRow goal={d.dailyGoal} cadence="Today" />
                  {d.weeklyGoals.map((g) => (
                    <GoalRow key={g.key} goal={g} cadence="This week" />
                  ))}
                </View>
              </Card>

              {/* Ranks: one column below sm */}
              <View style={{ gap: 12 }}>
                <Stat icon="🌍" value={rank(d.ranks?.globalRank)} label="Global rank" />
                <Stat icon="📍" value={rank(d.ranks?.countryRank)} label="Country rank" />
                <Stat icon="🎵" value={rank(d.ranks?.genreRank)} label="Genre rank" />
                {d.shares.leaderboard ? (
                  <View style={{ alignItems: "center", marginTop: -8 }}>
                    <ShareToSkool share={d.shares.leaderboard} label="Share your rank" size="sm" variant="ghost" />
                  </View>
                ) : null}
              </View>

              {/* Tools */}
              <View>
                <View style={{ marginBottom: 12 }}>
                  <SectionLabel>Your toolkit</SectionLabel>
                </View>
                <View style={styles.grid}>
                  {TOOLKIT.map((t) => (
                    <Card
                      key={t.href}
                      onPress={() => router.push(t.href as Href)}
                      style={styles.tile}
                      accessibilityLabel={`${t.title}. ${t.body}`}
                    >
                      <Text style={styles.tileIcon}>{t.icon}</Text>
                      <Text weight="semibold">{t.title}</Text>
                      <Text variant="caption">{t.body}</Text>
                    </Card>
                  ))}
                </View>
              </View>

              {/* Milestones */}
              <Card style={styles.cardP6}>
                <View style={{ marginBottom: 16 }}>
                  <SectionLabel>Milestones</SectionLabel>
                </View>
                <View style={{ gap: 12 }}>
                  {d.milestones.map((m) => (
                    <View key={m.key} style={styles.milestone}>
                      <Text style={[styles.mEmoji, !m.achieved && styles.locked]}>{m.icon}</Text>
                      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                        <View style={styles.between}>
                          <Text color={m.achieved ? colors.success : undefined} style={{ flex: 1 }}>{m.title}</Text>
                          <Text variant="caption">
                            {m.progress}/{m.target}
                          </Text>
                        </View>
                        <ProgressBar pct={m.target > 0 ? (m.progress / m.target) * 100 : 0} height={6} />
                      </View>
                    </View>
                  ))}
                </View>
              </Card>

              {/* Achievements: certificate + badges */}
              <Card style={styles.cardP6}>
                <View style={[styles.between, { marginBottom: 16 }]}>
                  <SectionLabel>Achievements</SectionLabel>
                  <Text variant="caption">
                    {d.badgesEarned} badge{d.badgesEarned === 1 ? "" : "s"} earned
                  </Text>
                </View>

                <Pressable
                  accessibilityRole="link"
                  onPress={() => router.push("/certificates")}
                  style={({ pressed }) => [styles.certStrip, pressed && { borderColor: colors.brand }]}
                >
                  <Text style={styles.certIcon}>🎓</Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text weight="semibold">{d.certificate ? "Program certificate earned" : "Program certificate"}</Text>
                    <Text variant="caption">
                      {d.certificate
                        ? "Tap to view and share your credential"
                        : program.total === 0
                          ? "No tracks published yet"
                          : `${program.completed}/${program.total} tracks complete — finish all to unlock`}
                    </Text>
                  </View>
                  {!d.certificate && program.total > 0 ? (
                    <Text variant="caption">{Math.round((program.completed / program.total) * 100)}%</Text>
                  ) : null}
                  {d.certificate ? <Text variant="caption" color={colors.success}>✓ View</Text> : null}
                </Pressable>

                <View style={styles.badges}>
                  {d.badges.map((b) => (
                    <BadgeImage key={b.key} image={b.image} name={b.name} dim={!b.earned} />
                  ))}
                </View>
              </Card>
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  row: { flexDirection: "row", gap: 12 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  cardP6: { padding: 24 },
  lg: { fontSize: 18, lineHeight: 28, fontFamily: fonts.semibold, color: colors.foreground },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  // Two columns that never stretch: a lone last tile stays half width, as on the web grid.
  tile: { width: "47%", flexGrow: 1, maxWidth: "48.5%" },
  tileIcon: { fontSize: 24, lineHeight: 32, marginBottom: 4 },
  certIcon: { fontSize: 24, lineHeight: 32 },
  milestone: { flexDirection: "row", alignItems: "center", gap: 12 },
  mEmoji: { fontSize: 20, lineHeight: 28 },
  locked: { opacity: 0.5, filter: [{ grayscale: 1 }] },
  certStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 16,
  },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
