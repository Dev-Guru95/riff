// Courses — the web's /courses catalog as a single column of cards.
// Data: GET /api/mobile/courses (published courses, orderIndex then slug).

import { View } from "react-native";
import { router, type Href } from "expo-router";

import { Card, EmptyState, PageHeader, ProgressBar, QueryView, Screen, Text } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { colors } from "@/theme/tokens";
import type { CourseCard, CoursesResponse } from "@/types/api";

function CourseItem({ c }: { c: CourseCard }) {
  const enrolled = c.enrollment;
  return (
    <Card onPress={() => router.push(`/courses/${c.slug}` as Href)} accessibilityLabel={`${c.title}, ${c.level}${enrolled ? `, enrolled, ${Math.round(enrolled.progressPct)}% complete` : ""}`} style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text variant="caption" color={colors.accent} style={{ textTransform: "uppercase", letterSpacing: 0.6 }}>{c.level}</Text>
        {enrolled ? <Text variant="caption" color={colors.success}>Enrolled</Text> : null}
      </View>
      <Text variant="heading">{c.title}</Text>
      <Text variant="small">{c.description}</Text>
      <Text variant="caption" style={{ marginTop: 6 }}>
        {c.moduleCount} {c.moduleCount === 1 ? "module" : "modules"} · {c.lessonCount} {c.lessonCount === 1 ? "lesson" : "lessons"}
      </Text>
      {enrolled ? (
        <View style={{ gap: 4, marginTop: 4 }}>
          <ProgressBar pct={enrolled.progressPct} />
          <Text variant="caption">{Math.round(enrolled.progressPct)}% complete</Text>
        </View>
      ) : null}
    </Card>
  );
}

export default function Courses() {
  const query = useApiQuery<CoursesResponse>("/api/mobile/courses");
  return (
    <Screen onRefresh={query.refetch}>
      <PageHeader title="Courses" subtitle="Structured paths from foundations to entrepreneurship." />
      <QueryView
        query={query}
        isEmpty={(d) => d.courses.length === 0}
        empty={<EmptyState icon="book" title="No courses yet" body="New tracks are on the way. Check back soon." />}
      >
        {(d) => (
          <View style={{ gap: 12 }}>
            {d.courses.map((c) => (
              <CourseItem key={c.id} c={c} />
            ))}
          </View>
        )}
      </QueryView>
    </Screen>
  );
}
