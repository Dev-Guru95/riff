// Home — the web's /dashboard, stacked into a single column for phones.
// Data: GET /api/mobile/dashboard (same computations as the web page).

import { View } from "react-native";
import { router, type Href } from "expo-router";

import { BadgeImage } from "@/components/BadgeImage";
import { ShareToSkool } from "@/components/ShareToSkool";
import { Button, Card, Icon, ProgressBar, ProgressRing, QueryView, Screen, Section, StatCard, Text, type IconName } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { colors } from "@/theme/tokens";
import type { DashboardResponse, Goal } from "@/types/api";

const TOOLKIT: { href: string; icon: IconName; title: string; body: string }[] = [
  { href: "/coach", icon: "chat", title: "AI Coach", body: "Personalized mentor" },
  { href: "/missions", icon: "target", title: "Missions", body: "Weekly challenges" },
  { href: "/audit", icon: "layers", title: "Social Audit", body: "Track real growth" },
  { href: "/roadmap", icon: "route", title: "Roadmap", body: "30/90-day plans" },
  { href: "/community", icon: "community", title: "Community", body: "Join on Skool" },
  { href: "/leaderboard", icon: "trophy", title: "Leaderboard", body: "Global ranks" },
  { href: "/certificates", icon: "graduation", title: "Certificates", body: "Your credentials" },
];

function GoalRow({ goal, cadence }: { goal: Goal; cadence: string }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ flex: 1 }} color={goal.done ? colors.success : undefined}>
          {goal.icon} {goal.label}
        </Text>
        <Text variant="caption">
          {cadence} · {goal.progress}/{goal.target}
        </Text>
      </View>
      <ProgressBar pct={goal.pct} height={6} />
    </View>
  );
}

export default function Dashboard() {
  const query = useApiQuery<DashboardResponse>("/api/mobile/dashboard");

  return (
    <Screen onRefresh={query.refetch}>
      <QueryView query={query}>
        {(d) => {
          const lvl = d.level;
          return (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="title" numberOfLines={2}>Hey {d.stageName ?? "artist"} 👋</Text>
                  <Text variant="small">
                    Level {lvl.levelNumber} · <Text variant="small" weight="medium" color={colors.brand}>{lvl.levelName}</Text>
                  </Text>
                  <Text variant="caption" style={{ marginTop: 4 }}>
                    {lvl.isMax ? "Max level reached!" : `${lvl.xpToNextLevel} XP to ${lvl.nextLevelName}`}
                  </Text>
                </View>
                <ProgressRing pct={lvl.progressPct} label={`${lvl.totalXp} XP`} size={76} />
              </View>
              <ShareToSkool share={d.shares.level} label="Share progress" />

              <View style={{ flexDirection: "row", gap: 12 }}>
                <StatCard icon="flame" value={d.streak.currentLen} label="Day streak" />
                <StatCard icon="zap" value={lvl.totalXp} label="Total XP" />
              </View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <StatCard icon="award" value={d.badgesEarned} label="Badges" />
                <StatCard icon="trophy" value={d.ranks?.globalRank ? `#${d.ranks.globalRank}` : "—"} label="Global rank" />
              </View>

              <Card style={{ gap: 12 }}>
                <Text variant="label">Your next move</Text>
                {d.nextLesson ? (
                  <>
                    <View>
                      <Text variant="caption" color={colors.accent}>{d.nextLesson.courseTitle}</Text>
                      <Text variant="heading">{d.nextLesson.title}</Text>
                    </View>
                    <ProgressBar pct={d.courseProgress} />
                    <Text variant="caption">{d.courseProgress}% of course complete</Text>
                    <Button title="Continue →" fullWidth onPress={() => router.push(`/learn/${d.nextLesson!.id}` as Href)} />
                  </>
                ) : d.courseComplete ? (
                  <>
                    <Text color={colors.success} weight="medium">🎉 Course complete! Explore more courses.</Text>
                    <Button title="Browse courses" variant="ghost" onPress={() => router.push("/courses")} />
                  </>
                ) : (
                  <Button title="Enroll in a course" onPress={() => router.push("/courses")} />
                )}
              </Card>

              <Card style={{ gap: 14 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text variant="label">Your goals</Text>
                  <Text variant="caption">Resets daily · weekly</Text>
                </View>
                <GoalRow goal={d.dailyGoal} cadence="Today" />
                {d.weeklyGoals.map((g) => (
                  <GoalRow key={g.key} goal={g} cadence="This week" />
                ))}
              </Card>

              <Section title="Ranks">
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <StatCard icon="globe" value={d.ranks?.globalRank ? `#${d.ranks.globalRank}` : "—"} label="Global" />
                  <StatCard icon="pin" value={d.ranks?.countryRank ? `#${d.ranks.countryRank}` : "—"} label="Country" />
                  <StatCard icon="music" value={d.ranks?.genreRank ? `#${d.ranks.genreRank}` : "—"} label="Genre" />
                </View>
                {d.shares.leaderboard ? <ShareToSkool share={d.shares.leaderboard} label="Share your rank" /> : null}
              </Section>

              <Section title="Your toolkit">
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                  {TOOLKIT.map((t) => (
                    <Card key={t.href} onPress={() => router.push(t.href as Href)} style={{ width: "47.5%", flexGrow: 1, gap: 4 }} accessibilityLabel={t.title}>
                      <Icon name={t.icon} size={22} color={colors.brand} />
                      <Text weight="semibold">{t.title}</Text>
                      <Text variant="caption">{t.body}</Text>
                    </Card>
                  ))}
                </View>
              </Section>

              <Card style={{ gap: 12 }}>
                <Text variant="label">Milestones</Text>
                {d.milestones.map((m) => (
                  <View key={m.key} style={{ flexDirection: "row", alignItems: "center", gap: 10, opacity: m.achieved ? 1 : 0.85 }}>
                    <Text style={{ fontSize: 20, opacity: m.achieved ? 1 : 0.5 }}>{m.icon}</Text>
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text color={m.achieved ? colors.success : undefined} style={{ flex: 1 }}>{m.title}</Text>
                        <Text variant="caption">{m.progress}/{m.target}</Text>
                      </View>
                      <ProgressBar pct={(m.progress / Math.max(1, m.target)) * 100} height={6} />
                    </View>
                  </View>
                ))}
              </Card>

              <Card style={{ gap: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text variant="label">Achievements</Text>
                  <Text variant="caption">{d.badgesEarned} badge{d.badgesEarned === 1 ? "" : "s"} earned</Text>
                </View>
                <Card onPress={() => router.push("/certificates")} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12 }}>
                  <Text style={{ fontSize: 22 }}>🎓</Text>
                  <View style={{ flex: 1 }}>
                    <Text weight="semibold">{d.certificate ? "Program certificate earned" : "Program certificate"}</Text>
                    <Text variant="caption">
                      {d.certificate
                        ? "Tap to view and share your credential"
                        : d.program.total === 0
                          ? "No tracks published yet"
                          : `${d.program.completed}/${d.program.total} tracks complete. Finish all to unlock.`}
                    </Text>
                  </View>
                  {d.certificate ? <Text variant="caption" color={colors.success}>✓ View</Text> : null}
                </Card>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
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
