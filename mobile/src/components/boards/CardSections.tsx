// Sections of the card screen that mirror CardModal.tsx: checklists,
// attachments, comments (Markdown editor, @mentions) and the card's activity.

import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from "react-native";

import { absoluteUrl } from "@/config/env";
import { errorMessage } from "@/api/errors";
import { Markdown } from "@/components/Markdown";
import { confirmBlock, useReport } from "@/components/moderation/useReport";
import { Button, Icon, ProgressBar, QueryView, Skeleton, Text, useToast } from "@/components/ui";
import { useApiQuery, useInvalidate } from "@/hooks/useApi";
import { openInBrowser } from "@/lib/links";
import { colors, fonts, radius, TOUCH } from "@/theme/tokens";
import type { ActivityResponse, BoardCapabilities, CardDetailDTO, ChecklistDTO, CommentsResponse } from "@/types/boards";
import { ActivityList } from "./BoardPanels";
import { Initials } from "./bits";
import { MarkdownEditor } from "./MarkdownEditor";
import { attachToCard, MAX_UPLOAD_BYTES, pickDocument, pickFromLibrary, type PickedFile } from "./attachments";
import { useActionSheet, usePrompt } from "./Sheet";
import { useBoardAction } from "./useBoardAction";
import { fmtTime, humanSize, mentionHandle } from "./utils";

/** CardModal's Section heading: text-xs muted. */
export function SectionTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionHead}>
      <Text variant="caption" accessibilityRole="header">{title}</Text>
      {right}
    </View>
  );
}

const confirm = (title: string, message: string, onConfirm: () => void, action = "Delete") =>
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: action, style: "destructive", onPress: onConfirm },
  ]);

// ---- Checklists ------------------------------------------------------------

function ChecklistBlock({
  checklist,
  editable,
  invalidates,
}: {
  checklist: ChecklistDTO;
  editable: boolean;
  invalidates: string[];
}) {
  const { run } = useBoardAction();
  const sheet = useActionSheet();
  const prompt = usePrompt();
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  async function addItem() {
    const t = text.trim();
    if (!t || adding) return;
    setAdding(true);
    const res = await run(`/api/checklists/${checklist.id}/items`, { body: { text: t }, invalidates });
    setAdding(false);
    if (res) setText("");
  }
  async function toggle(itemId: string, done: boolean) {
    if (toggling) return;
    setToggling(itemId);
    await run(`/api/checklist-items/${itemId}`, { method: "PATCH", body: { done: !done }, invalidates });
    setToggling(null);
  }
  function renameItem(item: ChecklistDTO["items"][number]) {
    prompt.show({
      title: "Rename item",
      initial: item.text,
      maxLength: 300,
      onSubmit: (t) => void run(`/api/checklist-items/${item.id}`, { method: "PATCH", body: { text: t }, invalidates }),
    });
  }
  function deleteChecklist() {
    confirm("Delete checklist?", `“${checklist.title}” and its ${checklist.items.length} item(s) will be deleted.`, () =>
      void run(`/api/checklists/${checklist.id}`, { method: "DELETE", invalidates }),
    );
  }
  function checklistMenu() {
    sheet.show({
      title: checklist.title,
      options: [
        {
          label: "Rename checklist",
          icon: "pencil",
          onPress: () =>
            prompt.show({
              title: "Rename checklist",
              initial: checklist.title,
              maxLength: 80,
              onSubmit: (t) => void run(`/api/checklists/${checklist.id}`, { method: "PATCH", body: { title: t }, invalidates }),
            }),
        },
        { label: "Delete checklist", icon: "close", destructive: true, onPress: deleteChecklist },
      ],
    });
  }

  return (
    <View>
      <View style={styles.checklistHead}>
        <Pressable
          disabled={!editable}
          onPress={checklistMenu}
          accessibilityRole={editable ? "button" : "header"}
          accessibilityHint={editable ? "Rename or delete checklist" : undefined}
          style={{ flex: 1, minHeight: 32, justifyContent: "center" }}
        >
          <Text weight="medium" numberOfLines={2}>{checklist.title}</Text>
        </Pressable>
        {editable ? (
          <Pressable onPress={deleteChecklist} accessibilityRole="button" accessibilityLabel={`Delete ${checklist.title}`} hitSlop={8} style={styles.textBtn}>
            <Text variant="caption">Delete</Text>
          </Pressable>
        ) : null}
      </View>
      {checklist.items.map((it) => (
        <Pressable
          key={it.id}
          disabled={!editable || !!toggling}
          onPress={() => void toggle(it.id, it.done)}
          onLongPress={editable ? () => renameItem(it) : undefined}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: it.done, disabled: !editable }}
          accessibilityHint={editable ? "Long press to rename" : undefined}
          style={({ pressed }) => [styles.itemRow, pressed && { backgroundColor: colors.surface2 }]}
        >
          <View style={[styles.checkbox, it.done && styles.checkboxOn]}>
            {toggling === it.id ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : it.done ? (
              <Icon name="check" size={13} color={colors.white} strokeWidth={2.5} />
            ) : null}
          </View>
          <Text style={[{ flex: 1 }, it.done && styles.doneText]}>{it.text}</Text>
          {editable ? (
            <Pressable
              onPress={() => void run(`/api/checklist-items/${it.id}`, { method: "DELETE", invalidates })}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${it.text}`}
              style={styles.iconBtnSm}
            >
              <Text variant="caption">✕</Text>
            </Pressable>
          ) : null}
        </Pressable>
      ))}
      {editable ? (
        <View style={styles.addItem}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Add an item"
            placeholderTextColor={colors.muted}
            selectionColor={colors.brand}
            maxLength={300}
            returnKeyType="done"
            submitBehavior="submit"
            onSubmitEditing={() => void addItem()}
            style={styles.inlineInput}
            accessibilityLabel={`Add an item to ${checklist.title}`}
          />
          <Button title="Add" size="sm" variant="ghost" onPress={() => void addItem()} loading={adding} disabled={!text.trim()} />
        </View>
      ) : null}
      {sheet.element}
      {prompt.element}
    </View>
  );
}

export function ChecklistsSection({ card, editable, invalidates }: { card: CardDetailDTO; editable: boolean; invalidates: string[] }) {
  const { run, busy } = useBoardAction();
  const items = card.checklists.flatMap((c) => c.items);
  const done = items.filter((i) => i.done).length;
  return (
    <View style={{ gap: 8 }}>
      <SectionTitle title={`Checklists${items.length ? ` — ${done}/${items.length}` : ""}`} />
      {items.length > 0 ? <ProgressBar pct={Math.round((done / items.length) * 100)} height={6} /> : null}
      {card.checklists.map((cl) => (
        <ChecklistBlock key={cl.id} checklist={cl} editable={editable} invalidates={invalidates} />
      ))}
      {editable ? (
        <Button
          title="+ Add checklist"
          size="sm"
          variant="ghost"
          loading={busy}
          onPress={() => void run(`/api/cards/${card.id}/checklists`, { body: { title: "Checklist" }, invalidates })}
        />
      ) : null}
    </View>
  );
}

// ---- Attachments -----------------------------------------------------------

export function AttachmentsSection({ card, editable, invalidates }: { card: CardDetailDTO; editable: boolean; invalidates: string[] }) {
  const { run } = useBoardAction();
  const toast = useToast();
  const invalidate = useInvalidate();
  const sheet = useActionSheet();
  const [uploading, setUploading] = useState(false);

  async function add(pick: () => Promise<PickedFile | null>) {
    if (uploading) return;
    let file: PickedFile | null;
    try {
      file = await pick();
    } catch {
      toast("Couldn't open the picker. Check the app's photo permission in Settings.", "error");
      return;
    }
    if (!file) return;
    if (file.size && file.size > MAX_UPLOAD_BYTES) {
      toast("That file is over the 25 MB limit.", "error");
      return;
    }
    setUploading(true);
    try {
      await attachToCard(card.id, file);
      await invalidate(...invalidates);
      toast("Attachment added");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={{ gap: 6 }}>
      <SectionTitle title={`Attachments${card.attachments.length ? ` — ${card.attachments.length}` : ""}`} />
      {card.attachments.map((a) => (
        <View key={a.id} style={styles.attachment}>
          <Pressable
            onPress={() => void openInBrowser(absoluteUrl(a.url))}
            accessibilityRole="link"
            accessibilityLabel={`Open ${a.name}`}
            style={({ pressed }) => [styles.attachmentLink, pressed && { opacity: 0.7 }]}
          >
            <Text>📎</Text>
            <Text style={{ flex: 1, minWidth: 0 }} numberOfLines={1}>{a.name}</Text>
            <Text variant="caption">{humanSize(a.size)}</Text>
          </Pressable>
          {editable ? (
            <Pressable
              onPress={() =>
                confirm("Remove attachment?", `“${a.name}” will be removed from this card.`, () =>
                  void run(`/api/attachments/${a.id}`, { method: "DELETE", invalidates, success: "Attachment removed" }),
                )
              }
              accessibilityRole="button"
              accessibilityLabel={`Remove ${a.name}`}
              style={styles.iconBtnSm}
            >
              <Text variant="caption">✕</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      {card.attachments.length === 0 ? <Text variant="caption">No attachments.</Text> : null}
      {editable ? (
        <Button
          title={uploading ? "Uploading…" : "+ Add attachment"}
          size="sm"
          variant="ghost"
          loading={uploading}
          onPress={() =>
            sheet.show({
              title: "Add attachment",
              message: "Images, audio, video or PDF · up to 25 MB",
              options: [
                { label: "Photo or video", icon: "grid", onPress: () => void add(pickFromLibrary) },
                { label: "File", icon: "clipboard", onPress: () => void add(pickDocument) },
              ],
            })
          }
        />
      ) : null}
      {sheet.element}
    </View>
  );
}

// ---- Comments --------------------------------------------------------------

export function CommentsSection({
  cardId,
  can,
  members,
  currentUserId,
  invalidates,
}: {
  cardId: string;
  can: BoardCapabilities;
  members: { userId: string; name: string }[];
  currentUserId: string | undefined;
  invalidates: string[];
}) {
  const path = `/api/cards/${cardId}/comments`;
  const query = useApiQuery<CommentsResponse>(path);
  const { run } = useBoardAction();
  const sheet = useActionSheet();
  const prompt = usePrompt();
  const report = useReport();
  const invalidate = useInvalidate();
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const all = [...invalidates, path, `/api/cards/${cardId}/activity`];

  async function post() {
    const t = text.trim();
    if (!t || posting) return;
    setPosting(true);
    const res = await run(path, { body: { body: t }, invalidates: all });
    setPosting(false);
    if (res) setText("");
  }
  const mention = (name: string) => setText((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}@${mentionHandle(name)} `);
  const others = members.filter((m) => m.userId !== currentUserId).slice(0, 6);

  function menu(c: CommentsResponse["comments"][number]) {
    // The server lets authors edit/delete their own comments and managers any
    // comment; everyone can report or block someone else's.
    const canDelete = c.mine || can.manageColumns;
    sheet.show({
      title: `Comment by ${c.author}`,
      options: [
        ...(c.mine
          ? [
              {
                label: "Edit",
                icon: "pencil" as const,
                onPress: () =>
                  prompt.show({
                    title: "Edit comment",
                    initial: c.body,
                    multiline: true,
                    maxLength: 5000,
                    onSubmit: (t) => void run(`/api/comments/${c.id}`, { method: "PATCH", body: { body: t }, invalidates: [path] }),
                  }),
              },
            ]
          : []),
        ...(c.mine
          ? []
          : [
              {
                label: "Report this comment",
                icon: "flag" as const,
                onPress: () =>
                  report.show({
                    targetType: "comment" as const,
                    targetId: c.id,
                    title: "Report this comment",
                    authorId: c.userId,
                    authorName: c.author,
                  }),
              },
              {
                label: `Block ${c.author}`,
                icon: "lock" as const,
                destructive: true,
                onPress: () =>
                  confirmBlock(c.author, c.userId, (blocked) => {
                    // Their comments are filtered server-side, so refetch.
                    if (blocked) void invalidate(path);
                  }),
              },
            ]),
        ...(canDelete
          ? [
              {
                label: "Delete",
                icon: "close" as const,
                destructive: true,
                onPress: () => confirm("Delete comment?", "This cannot be undone.", () => void run(`/api/comments/${c.id}`, { method: "DELETE", invalidates: all })),
              },
            ]
          : []),
      ],
    });
  }

  return (
    <View style={{ gap: 8 }}>
      <SectionTitle title="Comments" />
      <QueryView
        query={query}
        skeleton={<Skeleton height={60} />}
        isEmpty={(d) => d.comments.length === 0}
        empty={<Text variant="caption">No comments yet.</Text>}
      >
        {(d) => (
          <View style={{ gap: 12 }}>
            {d.comments.map((c) => (
              <View key={c.id} style={{ gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Initials name={c.author} size={20} />
                  <Text variant="caption" weight="medium" color={colors.foreground} numberOfLines={1} style={{ flexShrink: 1 }}>
                    {c.author}
                  </Text>
                  <Text variant="caption" style={{ flex: 1 }}>{fmtTime(c.createdAt)}</Text>
                  <Pressable onPress={() => menu(c)} accessibilityRole="button" accessibilityLabel={`Actions for ${c.author}'s comment`} style={styles.iconBtnSm}>
                    <Icon name="more" size={16} color={colors.muted} />
                  </Pressable>
                </View>
                <View style={{ paddingLeft: 28 }}>
                  <Markdown>{c.body}</Markdown>
                </View>
              </View>
            ))}
          </View>
        )}
      </QueryView>
      {can.comment ? (
        <View style={{ gap: 6 }}>
          <MarkdownEditor value={text} onChange={setText} rows={3} maxLength={5000} placeholder="Write a comment… use @name to mention" />
          {others.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
              <Text variant="caption">Mention:</Text>
              {others.map((m) => (
                <Pressable key={m.userId} onPress={() => mention(m.name)} accessibilityRole="button" hitSlop={6} style={styles.mention}>
                  <Text variant="caption" color={colors.foreground}>@{mentionHandle(m.name)}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Button title={posting ? "Posting…" : "Comment"} size="sm" onPress={() => void post()} loading={posting} disabled={!text.trim()} />
        </View>
      ) : null}
      {sheet.element}
      {prompt.element}
      {report.element}
    </View>
  );
}

// ---- Activity --------------------------------------------------------------

export function CardActivitySection({ cardId }: { cardId: string }) {
  const query = useApiQuery<ActivityResponse>(`/api/cards/${cardId}/activity`);
  return (
    <View style={{ gap: 8 }}>
      <SectionTitle title="Activity" />
      <QueryView query={query} skeleton={<Skeleton height={60} />}>
        {(d) => <ActivityList items={d.activity} compact />}
      </QueryView>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 20 },
  checklistHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 40, paddingLeft: 2 },
  textBtn: { minHeight: 32, justifyContent: "center", paddingHorizontal: 4 },
  iconBtnSm: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  doneText: { textDecorationLine: "line-through", color: colors.muted },
  addItem: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  inlineInput: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 10,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.foreground,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  attachment: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
  },
  attachmentLink: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minHeight: TOUCH, paddingLeft: 10 },
  mention: { paddingHorizontal: 6, minHeight: 28, justifyContent: "center", borderRadius: radius.sm, backgroundColor: colors.surface2 },
});
