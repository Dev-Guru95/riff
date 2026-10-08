// Course editor — the web's /admin/courses/[id] (page.tsx + EditClient.tsx +
// LessonBuilder.tsx + ReturnLinkEditor.tsx). Data: GET /api/mobile/admin/courses/:id
// (full tree incl. quiz answers). Every write is admin-only on the server.

import { useState } from "react";
import { View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { useStaffAccess } from "@/components/admin/access";
import { OptionPicker, ViewOnlyNote } from "@/components/admin/controls";
import { AddModuleForm, COURSES_PATH, ModuleCard } from "@/components/admin/CourseEditor";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button, Card, Chip, Field, QueryView, Screen, Text } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { colors } from "@/theme/tokens";
import type { AdminCourseDetailResponse } from "@/types/api";

const LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const DEFAULT_RETURN_LABEL = "Back to Skool"; // src/lib/returnLink.ts
const RETURN_URL_MAX = 2048;
const RETURN_LABEL_MAX = 60;

type Course = AdminCourseDetailResponse["course"];

function CourseFields({ course }: { course: Course }) {
  const { run, busy } = useAdminAction([COURSES_PATH]);
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description);
  const [level, setLevel] = useState(course.level);
  const dirty = title !== course.title || description !== course.description || level !== course.level;

  async function save() {
    if (title.trim().length < 3 || description.trim().length < 3) return;
    await run(`/api/admin/courses/${course.id}`, "PATCH", { title: title.trim(), description: description.trim(), level }, "Course saved");
  }

  async function togglePublish() {
    await run(`/api/admin/courses/${course.id}`, "PATCH", { isPublished: !course.isPublished }, course.isPublished ? "Moved to drafts" : "Published");
  }

  const tooShort = title.trim().length < 3 || description.trim().length < 3;

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text variant="label">Course details</Text>
        <Button
          title={course.isPublished ? "Published" : "Draft"}
          size="sm"
          variant={course.isPublished ? "primary" : "ghost"}
          icon={course.isPublished ? "check" : undefined}
          onPress={togglePublish}
          disabled={busy}
          accessibilityLabel={course.isPublished ? "Published. Tap to unpublish" : "Draft. Tap to publish"}
        />
      </View>
      <Field label="Title" value={title} onChangeText={setTitle} error={title.trim().length < 3 ? "At least 3 characters" : null} />
      <Field
        label="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        error={description.trim().length < 3 ? "At least 3 characters" : null}
      />
      <OptionPicker label="Level" value={level} options={LEVELS} onChange={setLevel} />
      <Button title="Save details" size="sm" onPress={save} loading={busy} disabled={!dirty || tooShort} />
    </Card>
  );
}

function ReturnLinkEditor({ course, fallbackUrl }: { course: Course; fallbackUrl: string }) {
  const { run, busy } = useAdminAction([COURSES_PATH]);
  const [url, setUrl] = useState(course.returnUrl ?? "");
  const [label, setLabel] = useState(course.returnLabel ?? "");
  const dirty = url !== (course.returnUrl ?? "") || label !== (course.returnLabel ?? "");

  async function save() {
    const saved = await run<{ returnUrl: string | null; returnLabel: string | null }>(
      `/api/admin/courses/${course.id}`,
      "PATCH",
      { returnUrl: url, returnLabel: label },
      "Return link saved",
    );
    // Adopt the server's normalized values so the form isn't dirty forever.
    if (saved) {
      setUrl(saved.returnUrl ?? "");
      setLabel(saved.returnLabel ?? "");
    }
  }

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <Text weight="semibold">When this track is finished</Text>
        <Text variant="caption">
          Where learners go after completing this track&apos;s questions — normally the next track in Skool. Shown on the completion
          screen and on the track page once it&apos;s 100% done.
        </Text>
      </View>
      <Field
        label="Return link"
        value={url}
        onChangeText={setUrl}
        maxLength={RETURN_URL_MAX}
        placeholder="https://www.skool.com/… (link to the NEXT track)"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      <Field
        label="Button label"
        value={label}
        onChangeText={setLabel}
        maxLength={RETURN_LABEL_MAX}
        placeholder={`${DEFAULT_RETURN_LABEL} — e.g. "Continue to Track 2"`}
      />
      {!url.trim() ? (
        <Text variant="caption">
          Empty — learners will be sent to the community home page instead: <Text variant="caption" color={colors.foreground}>{fallbackUrl}</Text>
        </Text>
      ) : null}
      <Button title="Save return link" size="sm" onPress={save} loading={busy} disabled={!dirty} />
    </Card>
  );
}

/** Read-only outline for staff who can view but not edit (reviewers, moderators). */
function ReadOnlyOutline({ modules }: { modules: AdminCourseDetailResponse["modules"] }) {
  return (
    <View style={{ gap: 10 }}>
      {modules.map((m, mi) => (
        <Card key={m.id} style={{ gap: 8 }}>
          <Text variant="heading">Module {mi + 1}: {m.title}</Text>
          {m.lessons.map((l, li) => (
            <View key={l.id} style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <Text style={{ flexShrink: 1 }}>{li + 1}. {l.title}</Text>
              <Text variant="caption">+{l.xpReward} XP</Text>
              {l.quiz ? <Chip label={`Quiz (${l.quiz.questions.length}q)`} tone="accent" /> : null}
              {l.assignment ? <Chip label="Assignment" tone="brand" /> : null}
            </View>
          ))}
          {m.lessons.length === 0 ? <Text variant="caption">No lessons yet.</Text> : null}
        </Card>
      ))}
    </View>
  );
}

export default function ManageCourse() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useApiQuery<AdminCourseDetailResponse>(id ? `${COURSES_PATH}/${id}` : null);
  const { role, can } = useStaffAccess();
  const canEdit = can("admin");

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: query.data?.course.title ?? "Course" }} />
      <QueryView query={query}>
        {(d) => (
          <>
            <View style={{ gap: 4 }}>
              <Text variant="title">{d.course.title}</Text>
              <Text variant="small">
                /{d.course.slug} · {d.course.isPublished ? "Published" : "Draft"} · v{d.course.version}
              </Text>
            </View>

            {canEdit ? (
              <>
                {/* Keyed by version/state so a refetch after a save re-seeds the forms. */}
                <CourseFields key={`f-${d.course.id}-${d.course.title}-${d.course.level}-${d.course.description.length}`} course={d.course} />
                <ReturnLinkEditor key={`r-${d.course.id}-${d.course.returnUrl}-${d.course.returnLabel}`} course={d.course} fallbackUrl={d.fallbackReturnUrl} />
                {d.modules.map((m, mi) => (
                  <ModuleCard key={m.id} id={m.id} index={mi} title={m.title} lessons={m.lessons} />
                ))}
                <AddModuleForm courseId={d.course.id} />
              </>
            ) : (
              <>
                <ViewOnlyNote role={role} needs="admin" />
                <ReadOnlyOutline modules={d.modules} />
              </>
            )}
          </>
        )}
      </QueryView>
    </Screen>
  );
}
