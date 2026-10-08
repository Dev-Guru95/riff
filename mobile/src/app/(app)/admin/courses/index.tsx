// Courses — the web's /admin/courses: every course (drafts too), a New course
// form, the publish toggle and a link into the editor. Data:
// GET /api/mobile/admin/courses. Writes (admin only): POST /api/admin/courses,
// PATCH /api/admin/courses/:id { isPublished }.

import { useState } from "react";
import { Alert, View } from "react-native";
import { router, Stack, type Href } from "expo-router";

import { useStaffAccess } from "@/components/admin/access";
import { OptionPicker, ViewOnlyNote } from "@/components/admin/controls";
import { COURSES_PATH } from "@/components/admin/CourseEditor";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button, Card, Chip, EmptyState, Field, QueryView, Screen, Text } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { colors } from "@/theme/tokens";
import type { AdminCoursesResponse } from "@/types/api";

const LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;
type Level = (typeof LEVELS)[number]["value"];

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function CreateCourseForm({ onDone }: { onDone: () => void }) {
  const { run, busy } = useAdminAction([COURSES_PATH]);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<Level>("beginner");
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    // Same rules as the route's zod schema, explained up front.
    if (title.trim().length < 3) return setErr("Title must be at least 3 characters.");
    if (slug.length < 3 || !/^[a-z0-9-]+$/.test(slug)) return setErr("Slug must be at least 3 characters: lowercase letters, numbers and hyphens.");
    if (description.trim().length < 3) return setErr("Description must be at least 3 characters.");
    setErr(null);
    const res = await run<{ id: string }>(
      "/api/admin/courses",
      "POST",
      { title: title.trim(), slug, description: description.trim(), level },
      "Course created as a draft",
    );
    if (res?.id) {
      onDone();
      router.push(`/admin/courses/${res.id}` as Href);
    }
  }

  return (
    <Card style={{ gap: 12 }}>
      <Text variant="heading">New course</Text>
      <Field
        label="Title"
        value={title}
        onChangeText={(v) => {
          setTitle(v);
          if (!slugTouched) setSlug(slugify(v));
        }}
      />
      <Field
        label="Slug"
        value={slug}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={(v) => {
          setSlugTouched(true);
          setSlug(slugify(v));
        }}
        hint={slug ? `/courses/${slug}` : undefined}
      />
      <Field label="Description" placeholder="One sentence on what this course teaches" value={description} onChangeText={setDescription} multiline />
      <OptionPicker label="Level" value={level} options={[...LEVELS]} onChange={setLevel} />
      {err ? <Text variant="caption" color={colors.danger}>{err}</Text> : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button title="Create" onPress={submit} loading={busy} />
        <Button title="Cancel" variant="ghost" onPress={onDone} />
      </View>
    </Card>
  );
}

function PublishToggle({ id, title, isPublished }: { id: string; title: string; isPublished: boolean }) {
  const { run, busy } = useAdminAction([COURSES_PATH]);
  function toggle() {
    Alert.alert(
      isPublished ? `Unpublish "${title}"?` : `Publish "${title}"?`,
      isPublished ? "Artists will no longer see this course." : "Artists will be able to enroll in this course.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isPublished ? "Unpublish" : "Publish",
          style: isPublished ? "destructive" : "default",
          onPress: () => void run(`/api/admin/courses/${id}`, "PATCH", { isPublished: !isPublished }, isPublished ? "Moved to drafts" : "Published"),
        },
      ],
    );
  }
  return (
    <Button
      title={isPublished ? "Published" : "Draft"}
      size="sm"
      variant={isPublished ? "primary" : "ghost"}
      icon={isPublished ? "check" : undefined}
      onPress={toggle}
      loading={busy}
      accessibilityLabel={isPublished ? "Published. Tap to unpublish" : "Draft. Tap to publish"}
    />
  );
}

export default function AdminCourses() {
  const query = useApiQuery<AdminCoursesResponse>(COURSES_PATH);
  const { role, can } = useStaffAccess();
  const canEdit = can("admin");
  const [creating, setCreating] = useState(false);

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: "Courses" }} />
      <Text variant="small">Create, import, and publish the tracks artists work through</Text>

      {canEdit ? (
        creating ? (
          <CreateCourseForm onDone={() => setCreating(false)} />
        ) : (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button title="New course" icon="plus" onPress={() => setCreating(true)} />
            <Button title="Import" icon="download" variant="ghost" onPress={() => router.push("/admin/import" as Href)} />
          </View>
        )
      ) : (
        <ViewOnlyNote role={role} needs="admin" />
      )}

      <QueryView
        query={query}
        isEmpty={(d) => d.courses.length === 0}
        empty={<EmptyState icon="graduation" title="No courses yet" body="Use New course to start one from scratch, or import an existing outline." />}
      >
        {(d) => (
          <View style={{ gap: 10 }}>
            {d.courses.map((c) => (
              <Card key={c.id} style={{ gap: 10 }} onPress={() => router.push(`/admin/courses/${c.id}` as Href)} accessibilityLabel={`Manage ${c.title}`}>
                <View style={{ gap: 4 }}>
                  <Text weight="semibold">{c.title}</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                    <Text variant="caption">/{c.slug}</Text>
                    <Chip label={c.level} />
                    <Text variant="caption">v{c.version}</Text>
                  </View>
                  <Text variant="caption">
                    {c.moduleCount} {c.moduleCount === 1 ? "module" : "modules"} · {c.lessonCount} {c.lessonCount === 1 ? "lesson" : "lessons"}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {canEdit ? (
                    <PublishToggle id={c.id} title={c.title} isPublished={c.isPublished} />
                  ) : (
                    <Chip label={c.isPublished ? "Published" : "Draft"} tone={c.isPublished ? "success" : "muted"} />
                  )}
                  <Text variant="caption" color={colors.accent} style={{ marginLeft: "auto" }}>{canEdit ? "Manage ›" : "View ›"}</Text>
                </View>
              </Card>
            ))}
          </View>
        )}
      </QueryView>
    </Screen>
  );
}
