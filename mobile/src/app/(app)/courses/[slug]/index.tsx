// Course detail — the web's /courses/[slug]: progress, track-complete card
// (badge, Share to Skool, return link) and the module → lesson tree.
// Data: GET /api/mobile/courses/[slug] (also upserts the enrollment, as the page does).

import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams, type Href } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { ShareToSkool } from "@/components/ShareToSkool";
import { SectionLabel } from "@/components/learning/Stat";
import { TrackReturnButton } from "@/components/learning/TrackReturnButton";
import { useRefetchOnFocus } from "@/components/learning/useRefetchOnFocus";
import { Card, ProgressBar, QueryView, Screen, Text } from "@/components/ui";
import { absoluteUrl } from "@/config/env";
import { useApiQuery } from "@/hooks/useApi";
import { colors } from "@/theme/tokens";
import type { CourseDetailResponse, CourseTreeLesson } from "@/types/api";

function LessonRow({ l }: { l: CourseTreeLesson }) {
  const locked = l.status === "locked";
  const done = l.status === "completed";
  const meta = [`${l.estMinutes} min`, `+${l.xpReward} XP`, l.hasQuiz ? "Quiz" : null, l.hasAssignment ? "Assignment" : null]
    .filter(Boolean)
    .join(" · ");
  const inner = (
    <View style={styles.lessonRow}>
      <View style={styles.lessonLeft}>
        <Text style={{ fontSize: 18, lineHeight: 28 }}>{done ? "✅" : locked ? "🔒" : "▶️"}</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text weight="medium">{l.title}</Text>
          <Text variant="caption" style={{ marginTop: 2 }}>{meta}</Text>
        </View>
      </View>
      {done ? <Text variant="caption" color={colors.success}>Done</Text> : null}
    </View>
  );
  const label = `${l.title}. ${meta}. ${done ? "Done" : locked ? "Locked" : l.status === "in_progress" ? "In progress" : "Available"}`;
  if (locked)
    return (
      <Card style={{ opacity: 0.5 }} accessibilityLabel={label}>
        {inner}
      </Card>
    );
  return (
    <Card onPress={() => router.push(`/learn/${l.id}` as Href)} accessibilityLabel={label}>
      {inner}
    </Card>
  );
}

export default function CourseDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const query = useApiQuery<CourseDetailResponse>(slug ? `/api/mobile/courses/${encodeURIComponent(slug)}` : null);
  useRefetchOnFocus(query.refetch);

  // Loading this screen enrols the artist (as the web page does), so the
  // catalog's "Enrolled" flag and the dashboard's next move may have changed.
  const qc = useQueryClient();
  const loaded = !!query.data;
  useEffect(() => {
    if (!loaded) return;
    void qc.invalidateQueries({ queryKey: ["/api/mobile/courses"], exact: true });
    void qc.invalidateQueries({ queryKey: ["/api/mobile/dashboard"], exact: true });
  }, [loaded, qc]);

  return (
    <Screen onRefresh={query.refetch} contentStyle={{ gap: 0 }}>
      <Stack.Screen options={{ title: query.data?.course.title ?? "Course" }} />
      <QueryView query={query}>
        {(d) => (
          <>
            <Pressable accessibilityRole="link" onPress={() => router.navigate("/courses")} hitSlop={8} style={{ alignSelf: "flex-start" }}>
              <Text variant="small">← All courses</Text>
            </Pressable>
            <Text variant="title" style={{ marginTop: 8 }}>{d.course.title}</Text>
            <Text variant="small" style={{ marginTop: 4, marginBottom: 16 }}>{d.course.description}</Text>

            {d.completed ? (
              <Card style={styles.completeCard}>
                <Image
                  source={{ uri: absoluteUrl(d.badge.image) }}
                  style={{ width: 56, height: 56 }}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  accessibilityIgnoresInvertColors
                />
                <View style={{ flex: 1, minWidth: 160 }}>
                  <Text variant="caption" color={colors.success} style={{ textTransform: "uppercase", letterSpacing: 0.3 }}>
                    Track complete
                  </Text>
                  <Text weight="semibold">{d.badge.name}</Text>
                  <Text variant="caption">This track badge is now yours. 🎉</Text>
                </View>
                <View style={styles.completeActions}>
                  {d.share ? <ShareToSkool share={d.share} size="sm" variant="ghost" /> : null}
                  <TrackReturnButton link={d.returnLink} size="sm" />
                </View>
              </Card>
            ) : null}

            <View style={{ marginBottom: 32 }}>
              <ProgressBar pct={d.course.progressPct} />
              <Text variant="caption" style={{ marginTop: 4 }}>
                {d.course.completedCount}/{d.course.lessonCount} lessons · {d.course.progressPct}% complete
              </Text>
            </View>

            <View style={{ gap: 24 }}>
              {d.modules.map((m, mi) => (
                <View key={m.id}>
                  <View style={{ marginBottom: 12 }}>
                    <SectionLabel>
                      Module {mi + 1}: {m.title}
                    </SectionLabel>
                  </View>
                  <View style={{ gap: 8 }}>
                    {m.lessons.map((l) => (
                      <LessonRow key={l.id} l={l} />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lessonRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  lessonLeft: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 },
  completeCard: {
    padding: 20,
    marginBottom: 24,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 16,
    borderColor: colors.brand,
  },
  completeActions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
});
