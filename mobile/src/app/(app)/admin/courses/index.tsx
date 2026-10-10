// Courses — the web's /admin/courses (page.tsx + CourseAdminClient.tsx): the
// "Course" header with its "New course ▾" split menu (Start fresh → the create
// form, Import → /admin/import), then one card per course (title, /slug, level
// chip, vN, module/lesson counts, the Published/Draft toggle and Manage).
// Data: GET /api/mobile/admin/courses. Writes (admin only, server-checked):
// POST /api/admin/courses, PATCH /api/admin/courses/:id { isPublished }.

import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, Stack, type Href } from "expo-router";

import { useStaffAccess } from "@/components/admin/access";
import { AdminEmpty, CardTitle, InlineMsg, OptionPicker, ViewOnlyNote } from "@/components/admin/controls";
import { COURSES_PATH } from "@/components/admin/CourseEditor";
import { fieldErrorMessage, useAdminCall } from "@/components/admin/useAdminAction";
import { Button, Card, Chip, Field, Icon, PageHeader, QueryView, Screen, Text } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { colors, fonts, radius } from "@/theme/tokens";
import type { AdminCoursesResponse } from "@/types/api";

const LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;
type Level = (typeof LEVELS)[number]["value"];

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Label with the web's pink required asterisk. */
const req = (label: string) => `${label} *`;

function CreateCourseForm({ onClose }: { onClose: () => void }) {
  const { call, busy } = useAdminCall([COURSES_PATH, "/api/mobile/admin/overview"]);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<Level>("beginner");
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    // The web form's `required minLength={3}` checks, before the request.
    if (title.trim().length < 3) return setErr("Title must be at least 3 characters");
    if (slug.length < 3) return setErr("Slug must be at least 3 characters");
    if (description.trim().length < 3) return setErr("Description must be at least 3 characters");
    const res = await call("/api/admin/courses", "POST", { title, slug, description, level });
    if (res.ok) {
      onClose();
    } else if (res.error) {
      setErr(fieldErrorMessage(res.body) ?? res.error ?? "Failed to create course");
    }
  }

  return (
    <Card style={{ padding: 20, gap: 12 }}>
      <CardTitle size={16}>New course</CardTitle>
      <Field
        label={req("Title")}
        value={title}
        onChangeText={(v) => {
          setTitle(v);
          if (!slugTouched) setSlug(slugify(v));
        }}
      />
      <Field
        label={req("Slug")}
        value={slug}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={(v) => {
          setSlugTouched(true);
          setSlug(slugify(v));
        }}
      />
      <Field label={req("Description")} placeholder="One sentence on what this course teaches" value={description} onChangeText={setDescription} />
      <OptionPicker label="Level" value={level} options={[...LEVELS]} onChange={setLevel} />
      {err ? <InlineMsg ok={false}>{err}</InlineMsg> : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button title={busy ? "Creating…" : "Create"} onPress={submit} disabled={busy} />
        <Button title="Cancel" variant="ghost" onPress={onClose} />
      </View>
    </Card>
  );
}

/** The web's split button: "New course ▾" → Start fresh / Import. */
function NewCourseMenu({ onStartFresh }: { onStartFresh: () => void }) {
  return (
    <View style={styles.menu} accessibilityRole="menu">
      <Pressable accessibilityRole="menuitem" onPress={onStartFresh} style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: colors.surface2 }]}>
        <Icon name="pencil" size={15} color={colors.foreground} />
        <Text>Start fresh</Text>
      </Pressable>
      <Pressable
        accessibilityRole="menuitem"
        onPress={() => router.push("/admin/import" as Href)}
        style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: colors.surface2 }]}
      >
        <Icon name="download" size={15} color={colors.foreground} />
        <Text>Import</Text>
      </Pressable>
    </View>
  );
}

/** Web PublishToggle: green "Published" pill (black text) or surface-2 muted "Draft". */
function PublishToggle({ id, isPublished }: { id: string; isPublished: boolean }) {
  const { call, busy } = useAdminCall([COURSES_PATH]);
  return (
    <Pressable
      onPress={() => void call(`/api/admin/courses/${id}`, "PATCH", { isPublished: !isPublished })}
      disabled={busy}
      accessibilityRole="switch"
      accessibilityState={{ checked: isPublished, disabled: busy }}
      accessibilityLabel={isPublished ? "Published. Tap to move to drafts" : "Draft. Tap to publish"}
      hitSlop={6}
      style={({ pressed }) => [
        styles.toggle,
        { backgroundColor: isPublished ? colors.success : colors.surface2 },
        (busy || pressed) && { opacity: busy ? 0.5 : 0.85 },
      ]}
    >
      <Text style={{ fontSize: 12, lineHeight: 16, fontFamily: fonts.medium, color: isPublished ? colors.background : colors.muted }}>
        {isPublished ? "Published" : "Draft"}
      </Text>
    </Pressable>
  );
}

export default function AdminCourses() {
  const query = useApiQuery<AdminCoursesResponse>(COURSES_PATH);
  const { role, can } = useStaffAccess();
  const canEdit = can("admin");
  const [menuOpen, setMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: "Courses" }} />
      <PageHeader
        title="Course"
        subtitle="Create, import, and publish the tracks artists work through"
      />
      {/* At phone width the web's header row wraps, putting the button under the title. */}
      {canEdit ? (
        <Button
          title="New course ▾"
          onPress={() => {
            setMenuOpen((v) => !v);
            setCreating(false);
          }}
          accessibilityLabel="New course menu"
        />
      ) : null}

      {!canEdit ? <ViewOnlyNote role={role} needs="admin" /> : null}
      {canEdit && menuOpen ? (
        <NewCourseMenu
          onStartFresh={() => {
            setMenuOpen(false);
            setCreating(true);
          }}
        />
      ) : null}
      {canEdit && creating ? <CreateCourseForm onClose={() => setCreating(false)} /> : null}

      <QueryView
        query={query}
        isEmpty={(d) => d.courses.length === 0}
        empty={<AdminEmpty icon="graduation" title="No courses yet" hint="Use New course to start one from scratch, or import an existing outline." />}
      >
        {(d) => (
          <View style={{ gap: 10 }}>
            {d.courses.map((c) => (
              <Card key={c.id} style={{ gap: 12 }}>
                <View style={{ gap: 4 }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 8, rowGap: 4 }}>
                    <Text weight="semibold" style={{ fontSize: 16, lineHeight: 24 }} onPress={() => router.push(`/admin/courses/${c.id}` as Href)} accessibilityRole="link">
                      {c.title}
                    </Text>
                    <Text variant="caption">/{c.slug}</Text>
                    <Chip label={c.level} />
                    <Text variant="caption">v{c.version}</Text>
                  </View>
                  <Text variant="caption">
                    {c.moduleCount} {c.moduleCount === 1 ? "module" : "modules"} · {c.lessonCount} {c.lessonCount === 1 ? "lesson" : "lessons"}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  {canEdit ? (
                    <PublishToggle id={c.id} isPublished={c.isPublished} />
                  ) : (
                    <Chip label={c.isPublished ? "Published" : "Draft"} tone={c.isPublished ? "success" : "muted"} />
                  )}
                  <Button title="Manage" variant="ghost" size="sm" onPress={() => router.push(`/admin/courses/${c.id}` as Href)} accessibilityLabel={`Manage ${c.title}`} />
                </View>
              </Card>
            ))}
          </View>
        )}
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  menu: {
    alignSelf: "flex-end",
    width: 176,
    padding: 4,
    marginTop: -16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
  },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, minHeight: 44, borderRadius: radius.md },
  toggle: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, minHeight: 28, justifyContent: "center" },
});
