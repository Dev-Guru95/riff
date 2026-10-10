// Courses — the web's /courses catalog as a single column of cards.
// Data: GET /api/mobile/courses (published courses, orderIndex then slug).

import { View } from "react-native";
import { router, type Href } from "expo-router";

import { Card, PageHeader, ProgressBar, QueryView, Screen, Text } from "@/components/ui";
import { useRefetchOnFocus } from "@/components/learning/useRefetchOnFocus";
import { useApiQuery } from "@/hooks/useApi";
import { colors } from "@/theme/tokens";
import type { CourseCard, CoursesResponse } from "@/types/api";

function CourseItem({ c }: { c: CourseCard }) {
  const enrolled = c.enrollment;
  return (
    <Card
      onPress={() => router.push(`/courses/${c.slug}` as Href)}
      accessibilityLabel={`${c.title}, ${c.level}${enrolled ? `, enrolled, ${Math.round(enrolled.progressPct)}% complete` : ""}`}
      style={{ padding: 24 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <Text variant="caption" color={colors.accent} style={{ textTransform: "uppercase", letterSpacing: 0.3 }}>{c.level}</Text>
        {enrolled ? <Text variant="caption" color={colors.success}>Enrolled</Text> : null}
      </View>
      <Text variant="heading">{c.title}</Text>
      <Text variant="small" style={{ marginTop: 4, marginBottom: 16 }}>{c.description}</Text>
      <Text variant="caption" style={{ marginBottom: 8 }}>
        {c.moduleCount} {c.moduleCount === 1 ? "module" : "modules"} · {c.lessonCount} {c.lessonCount === 1 ? "lesson" : "lessons"}
      </Text>
      {enrolled ? (
        <>
          <ProgressBar pct={enrolled.progressPct} />
          <Text variant="caption" style={{ marginTop: 4 }}>{Math.round(enrolled.progressPct)}% complete</Text>
        </>
      ) : null}
    </Card>
  );
}

export default function Courses() {
  const query = useApiQuery<CoursesResponse>("/api/mobile/courses");
  useRefetchOnFocus(query.refetch);
  return (
    <Screen onRefresh={query.refetch}>
      <PageHeader title="Courses" subtitle="Structured paths from foundations to entrepreneurship." />
      <QueryView query={query}>
        {(d) => (
          <View style={{ gap: 16 }}>
            {d.courses.map((c) => (
              <CourseItem key={c.id} c={c} />
            ))}
          </View>
        )}
      </QueryView>
    </Screen>
  );
}
