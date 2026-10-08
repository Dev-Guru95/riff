// Course detail — the web's /courses/[slug]: progress, track-complete card
// (badge, Share to Skool, return link) and the module → lesson tree.
// Data: GET /api/mobile/courses/[slug] (also upserts the enrollment, as the page does).

import { View } from "react-native";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams, type Href } from "expo-router";

import { ShareToSkool } from "@/components/ShareToSkool";
import { TrackReturnButton } from "@/components/learning/TrackReturnButton";
import { Card, ProgressBar, QueryView, Screen, Section, Text } from "@/components/ui";
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
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Text style={{ fontSize: 18 }}>{done ? "✅" : locked ? "🔒" : "▶️"}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text weight="medium">{l.title}</Text>
        <Text variant="caption" style={{ marginTop: 2 }}>{meta}</Text>
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

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: query.data?.course.title ?? "Course" }} />
      <QueryView query={query}>
        {(d) => (
          <>
            <View>
              <Text variant="title">{d.course.title}</Text>
              <Text variant="small" style={{ marginTop: 4 }}>{d.course.description}</Text>
            </View>

            {d.completed ? (
              <Card style={{ gap: 12, borderColor: colors.brand }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <Image
                    source={{ uri: absoluteUrl(d.badge.image) }}
                    style={{ width: 56, height: 56 }}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    accessibilityIgnoresInvertColors
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="caption" color={colors.success} style={{ textTransform: "uppercase", letterSpacing: 0.6 }}>Track complete</Text>
                    <Text weight="semibold">{d.badge.name}</Text>
                    <Text variant="caption">This track badge is now yours. 🎉</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {d.share ? <ShareToSkool share={d.share} /> : null}
                  <TrackReturnButton link={d.returnLink} size="sm" />
                </View>
              </Card>
            ) : null}

            <View style={{ gap: 4 }}>
              <ProgressBar pct={d.course.progressPct} />
              <Text variant="caption">
                {d.course.completedCount}/{d.course.lessonCount} lessons · {d.course.progressPct}% complete
              </Text>
            </View>

            {d.modules.map((m, mi) => (
              <Section key={m.id} title={`Module ${mi + 1}: ${m.title}`}>
                <View style={{ gap: 8 }}>
                  {m.lessons.map((l) => (
                    <LessonRow key={l.id} l={l} />
                  ))}
                  {m.lessons.length === 0 ? <Text variant="caption">No lessons in this module yet.</Text> : null}
                </View>
              </Section>
            ))}
          </>
        )}
      </QueryView>
    </Screen>
  );
}
