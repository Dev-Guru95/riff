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
  const prog = c.progression;
  return (
    <Card
      onPress={() => router.push(`/courses/${c.slug}` as Href)}
      accessibilityLabel={`${c.title}, ${c.level}${prog ? `, track ${prog.position}` : ""}${prog?.completed ? ", quiz passed" : enrolled ? `, enrolled, ${Math.round(enrolled.progressPct)}% complete` : ""}${prog?.unlocked && !prog.completed ? ", start here" : ""}`}
      style={{ padding: 24 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <Text variant="caption" color={colors.accent} style={{ textTransform: "uppercase", letterSpacing: 0.3 }}>
          {prog ? `Track ${prog.position} · ` : ""}{c.level}
        </Text>
        {prog?.completed ? (
          <Text variant="caption" color={colors.success}>✓ Quiz passed</Text>
        ) : enrolled ? (
          <Text variant="caption" color={colors.success}>Enrolled</Text>
        ) : null}
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
      {/* The recommended order, shown rather than enforced: Skool deep-links
          into any track's quiz, and blocking those would dead-end students
          arriving from the classroom. */}
      {prog && !prog.completed && !prog.unlocked && prog.blockedBy ? (
        <Text variant="caption" style={{ marginTop: 8 }}>
          ↪ Recommended after <Text variant="caption" color={colors.foreground}>{prog.blockedBy}</Text>
        </Text>
      ) : null}
      {prog?.unlocked && !prog.completed ? (
        <Text variant="caption" color={colors.accent} style={{ marginTop: 8 }}>▶ Start here</Text>
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
