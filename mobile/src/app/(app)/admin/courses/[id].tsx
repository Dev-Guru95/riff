// Course editor — the web's /admin/courses/[id] (page.tsx + EditClient.tsx +
// LessonBuilder.tsx + ReturnLinkEditor.tsx), in the same order: "← All courses",
// the title with "/slug · Published|Draft · vN", the return-link card, one card
// per module (lessons + "+ Add lesson"), then "+ Add module".
// Data: GET /api/mobile/admin/courses/:id (full tree incl. quiz answers).
// Every write is admin-only on the server.

import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { router, Stack, useLocalSearchParams, type Href } from "expo-router";

import { useStaffAccess } from "@/components/admin/access";
import { CardTitle, InlineMsg, MONO, ViewOnlyNote } from "@/components/admin/controls";
import { AddModuleForm, COURSES_PATH, ModuleCard } from "@/components/admin/CourseEditor";
import { useAdminCall } from "@/components/admin/useAdminAction";
import { Button, Card, Field, QueryView, Screen, Text } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import type { AdminCourseDetailResponse } from "@/types/api";

// src/lib/returnLink.ts
const DEFAULT_RETURN_LABEL = "Back to Skool";
const RETURN_URL_MAX = 2048;
const RETURN_LABEL_MAX = 60;

type Course = AdminCourseDetailResponse["course"];

function ReturnLinkEditor({ course, fallbackUrl }: { course: Course; fallbackUrl: string }) {
  const { call, busy } = useAdminCall([COURSES_PATH]);
  const [url, setUrl] = useState(course.returnUrl ?? "");
  const [label, setLabel] = useState(course.returnLabel ?? "");
  const [saved, setSaved] = useState({ url: course.returnUrl ?? "", label: course.returnLabel ?? "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function save() {
    setErr(null);
    setMsg(null);
    const res = await call<{ returnUrl: string | null; returnLabel: string | null }>(`/api/admin/courses/${course.id}`, "PATCH", {
      returnUrl: url,
      returnLabel: label,
    });
    if (res.ok) {
      // Adopt the stored (trimmed/normalized) values so the form isn't dirty forever.
      const next = { url: res.data.returnUrl ?? "", label: res.data.returnLabel ?? "" };
      setUrl(next.url);
      setLabel(next.label);
      setSaved(next);
      setMsg("Saved");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMsg(null), 2500);
    } else if (res.error) {
      setErr(res.error || "Could not save the return link");
    }
  }

  const dirty = url !== saved.url || label !== saved.label;

  return (
    <Card style={{ padding: 20, gap: 12 }}>
      <View>
        <CardTitle size={16}>When this track is finished</CardTitle>
        <Text variant="caption" style={{ marginTop: 4 }}>
          Where learners go after completing this track&apos;s questions — normally the next track in Skool. Shown on the completion
          screen and on the track page once it&apos;s 100% done.
        </Text>
      </View>
      <Field
        label="Return link"
        value={url}
        onChangeText={setUrl}
        maxLength={RETURN_URL_MAX}
        placeholder="https://www.skool.com/…  (link to the NEXT track)"
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
          Empty — learners will be sent to the community home page instead:{" "}
          <Text variant="caption" selectable style={{ fontFamily: MONO }}>{fallbackUrl}</Text>
        </Text>
      ) : null}
      {err ? <InlineMsg ok={false}>{err}</InlineMsg> : null}
      {msg ? <InlineMsg ok>{msg}</InlineMsg> : null}
      <Button title={busy ? "Saving…" : "Save return link"} size="sm" onPress={save} disabled={busy || !dirty} />
    </Card>
  );
}

/** Read-only outline for staff who can view but not edit (reviewers, moderators). */
function ReadOnlyOutline({ modules }: { modules: AdminCourseDetailResponse["modules"] }) {
  return (
    <View style={{ gap: 20 }}>
      {modules.map((m, mi) => (
        <Card key={m.id} style={{ padding: 20, gap: 8 }}>
          <CardTitle size={16}>
            Module {mi + 1}: {m.title}
          </CardTitle>
          {m.lessons.map((l, li) => (
            <Text key={l.id}>
              {li + 1}. {l.title}{" "}
              <Text variant="caption">
                +{l.xpReward} XP{l.quiz ? ` · Quiz (${l.quiz.questions.length}q)` : ""}
                {l.assignment ? " · Assignment" : ""}
              </Text>
            </Text>
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
    <Screen onRefresh={query.refetch} contentStyle={{ gap: 24 }}>
      <Stack.Screen options={{ title: query.data?.course.title ?? "Course" }} />
      <Pressable onPress={() => router.dismissTo("/admin/courses" as Href)} accessibilityRole="link" hitSlop={8} style={{ alignSelf: "flex-start", paddingVertical: 4 }}>
        <Text variant="small">← All courses</Text>
      </Pressable>
      <QueryView query={query}>
        {(d) => (
          <>
            <View>
              <Text variant="title">{d.course.title}</Text>
              <Text variant="small">
                /{d.course.slug} · {d.course.isPublished ? "Published" : "Draft"} · v{d.course.version}
              </Text>
            </View>

            {canEdit ? (
              <>
                {/* Adopts the saved values itself, so a refetch must not remount it (that would drop "Saved"). */}
                <ReturnLinkEditor key={d.course.id} course={d.course} fallbackUrl={d.fallbackReturnUrl} />
                <View style={{ gap: 20 }}>
                  {d.modules.map((m, mi) => (
                    <ModuleCard key={m.id} id={m.id} index={mi} title={m.title} lessons={m.lessons} />
                  ))}
                </View>
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
