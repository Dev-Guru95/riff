// Sections of the card screen that mirror CardModal.tsx: checklists,
// attachments, comments (Markdown, @mentions) and the card's activity.

import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from "react-native";

import { absoluteUrl } from "@/config/env";
import { errorMessage } from "@/api/errors";
import { Markdown } from "@/components/Markdown";
import { Avatar, Button, Card, Field, Icon, ProgressBar, QueryView, Skeleton, Text, useToast } from "@/components/ui";
import { useApiQuery, useInvalidate } from "@/hooks/useApi";
import { openInBrowser } from "@/lib/links";
import { colors, fonts, radius, TOUCH } from "@/theme/tokens";
import type { ActivityResponse, BoardCapabilities, CardDetailDTO, ChecklistDTO, CommentsResponse } from "@/types/boards";
import { ActivityList } from "./BoardPanels";
import { attachToCard, MAX_UPLOAD_BYTES, pickDocument, pickFromLibrary, type PickedFile } from "./attachments";
import { useActionSheet, usePrompt } from "./Sheet";
import { useBoardAction } from "./useBoardAction";
import { fmtTime, humanSize, mentionHandle } from "./utils";

export function SectionTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionHead}>
      <Text variant="label" accessibilityRole="header">{title}</Text>
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
    if (!t) return;
    setAdding(true);
    const res = await run(`/api/checklists/${checklist.id}/items`, { body: { text: t }, invalidates });
    setAdding(false);
    if (res) setText("");
  }
  async function toggle(itemId: string, done: boolean) {
    setToggling(itemId);
    await run(`/api/checklist-items/${itemId}`, { method: "PATCH", body: { done: !done }, invalidates });
    setToggling(null);
  }
  function itemMenu(item: ChecklistDTO["items"][number]) {
    sheet.show({
      title: item.text,
      options: [
        {
          label: "Rename",
          icon: "pencil",
          onPress: () =>
            prompt.show({
              title: "Rename item",
              initial: item.text,
              maxLength: 300,
              onSubmit: (t) => void run(`/api/checklist-items/${item.id}`, { method: "PATCH", body: { text: t }, invalidates }),
            }),
        },
        { label: "Delete item", icon: "close", destructive: true, onPress: () => void run(`/api/checklist-items/${item.id}`, { method: "DELETE", invalidates }) },
      ],
    });
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
        {
          label: "Delete checklist",
          icon: "close",
          destructive: true,
          onPress: () =>
            confirm("Delete checklist?", `“${checklist.title}” and its ${checklist.items.length} item(s) will be deleted.`, () =>
              void run(`/api/checklists/${checklist.id}`, { method: "DELETE", invalidates, success: "Checklist deleted" }),
            ),
        },
      ],
    });
  }

  return (
    <Card padded={false} style={{ overflow: "hidden" }}>
      <View style={[styles.rowBase, { paddingLeft: 16 }]}>
        <Text weight="semibold" style={{ flex: 1 }} numberOfLines={2}>{checklist.title}</Text>
        {editable ? (
          <Pressable onPress={checklistMenu} accessibilityRole="button" accessibilityLabel={`${checklist.title} actions`} style={styles.iconBtn}>
            <Icon name="more" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {checklist.items.map((it) => (
        <Pressable
          key={it.id}
          disabled={!editable || toggling === it.id}
          onPress={() => void toggle(it.id, it.done)}
          onLongPress={editable ? () => itemMenu(it) : undefined}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: it.done, disabled: !editable }}
          accessibilityHint={editable ? "Long press to rename or delete" : undefined}
          style={({ pressed }) => [styles.rowBase, { paddingLeft: 16 }, pressed && { backgroundColor: colors.surface2 }]}
        >
          <View style={[styles.checkbox, it.done && styles.checkboxOn]}>
            {toggling === it.id ? <ActivityIndicator size="small" color={colors.white} /> : it.done ? <Icon name="check" size={14} color={colors.white} strokeWidth={2.5} /> : null}
          </View>
          <Text style={[{ flex: 1 }, it.done && styles.doneText]}>{it.text}</Text>
          {editable ? (
            <Pressable onPress={() => itemMenu(it)} accessibilityRole="button" accessibilityLabel={`${it.text} actions`} style={styles.iconBtn}>
              <Icon name="more" size={16} color={colors.muted} />
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
    </Card>
  );
}

export function ChecklistsSection({ card, editable, invalidates }: { card: CardDetailDTO; editable: boolean; invalidates: string[] }) {
  const { run, busy } = useBoardAction();
  const prompt = usePrompt();
  const items = card.checklists.flatMap((c) => c.items);
  const done = items.filter((i) => i.done).length;
  return (
    <View style={{ gap: 10 }}>
      <SectionTitle title={`Checklists${items.length ? ` — ${done}/${items.length}` : ""}`} />
      {items.length > 0 ? <ProgressBar pct={(done / items.length) * 100} height={6} /> : null}
      {card.checklists.map((cl) => (
        <ChecklistBlock key={cl.id} checklist={cl} editable={editable} invalidates={invalidates} />
      ))}
      {card.checklists.length === 0 && !editable ? <Text variant="small">No checklists.</Text> : null}
      {editable ? (
        <Button
          title="Add checklist"
          icon="plus"
          size="sm"
          variant="ghost"
          loading={busy}
          onPress={() =>
            prompt.show({
              title: "New checklist",
              initial: "Checklist",
              confirmLabel: "Add",
              maxLength: 80,
              onSubmit: (t) => void run(`/api/cards/${card.id}/checklists`, { body: { title: t }, invalidates }),
            })
          }
        />
      ) : null}
      {prompt.element}
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
    <View style={{ gap: 10 }}>
      <SectionTitle title={`Attachments${card.attachments.length ? ` — ${card.attachments.length}` : ""}`} />
      {card.attachments.length === 0 ? <Text variant="small">No attachments.</Text> : null}
      {card.attachments.map((a) => (
        <Card key={a.id} padded={false} style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable
            onPress={() => void openInBrowser(absoluteUrl(a.url))}
            accessibilityRole="link"
            accessibilityLabel={`Open ${a.name}`}
            style={({ pressed }) => [styles.rowBase, { flex: 1, paddingLeft: 14 }, pressed && { opacity: 0.7 }]}
          >
            <Icon name="clipboard" size={18} color={colors.muted} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1}>{a.name}</Text>
              <Text variant="caption">{humanSize(a.size)}</Text>
            </View>
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
              style={styles.iconBtn}
            >
              <Icon name="close" size={16} color={colors.muted} />
            </Pressable>
          ) : null}
        </Card>
      ))}
      {editable ? (
        <Button
          title={uploading ? "Uploading…" : "Add attachment"}
          icon="plus"
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
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const all = [...invalidates, path, `/api/cards/${cardId}/activity`];

  async function post() {
    const t = text.trim();
    if (!t) return;
    setPosting(true);
    const res = await run(path, { body: { body: t }, invalidates: all });
    setPosting(false);
    if (res) setText("");
  }
  const mention = (name: string) => setText((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}@${mentionHandle(name)} `);

  function menu(c: CommentsResponse["comments"][number]) {
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
        {
          label: "Delete",
          icon: "close" as const,
          destructive: true,
          onPress: () => confirm("Delete comment?", "This cannot be undone.", () => void run(`/api/comments/${c.id}`, { method: "DELETE", invalidates: all })),
        },
      ],
    });
  }

  return (
    <View style={{ gap: 10 }}>
      <SectionTitle title="Comments" />
      <QueryView
        query={query}
        skeleton={<Skeleton height={60} />}
        isEmpty={(d) => d.comments.length === 0}
        empty={<Text variant="small">No comments yet.</Text>}
      >
        {(d) => (
          <View style={{ gap: 14 }}>
            {d.comments.map((c) => {
              const canAct = c.mine || can.manageColumns;
              return (
                <View key={c.id} style={{ gap: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Avatar name={c.author} size={24} />
                    <Text weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>{c.author}</Text>
                    <Text variant="caption" style={{ flex: 1 }}>{fmtTime(c.createdAt)}</Text>
                    {canAct ? (
                      <Pressable onPress={() => menu(c)} accessibilityRole="button" accessibilityLabel="Comment actions" style={styles.iconBtnSm}>
                        <Icon name="more" size={16} color={colors.muted} />
                      </Pressable>
                    ) : null}
                  </View>
                  <View style={{ paddingLeft: 32 }}>
                    <Markdown>{c.body}</Markdown>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </QueryView>
      {can.comment ? (
        <View style={{ gap: 8 }}>
          <Field
            value={text}
            onChangeText={setText}
            multiline
            maxLength={5000}
            placeholder="Write a comment… use @name to mention"
            accessibilityLabel="Write a comment"
            style={{ minHeight: 88 }}
          />
          {members.filter((m) => m.userId !== currentUserId).length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <Text variant="caption">Mention:</Text>
              {members
                .filter((m) => m.userId !== currentUserId)
                .slice(0, 8)
                .map((m) => (
                  <Pressable key={m.userId} onPress={() => mention(m.name)} accessibilityRole="button" hitSlop={6} style={styles.mention}>
                    <Text variant="caption" color={colors.foreground}>@{mentionHandle(m.name)}</Text>
                  </Pressable>
                ))}
            </View>
          ) : null}
          <Button title="Comment" size="sm" onPress={() => void post()} loading={posting} disabled={!text.trim()} />
        </View>
      ) : null}
      {sheet.element}
      {prompt.element}
    </View>
  );
}

// ---- Activity --------------------------------------------------------------

export function CardActivitySection({ cardId }: { cardId: string }) {
  const query = useApiQuery<ActivityResponse>(`/api/cards/${cardId}/activity`);
  return (
    <View style={{ gap: 10 }}>
      <SectionTitle title="Activity" />
      <QueryView query={query} skeleton={<Skeleton height={60} />}>
        {(d) => <ActivityList items={d.activity} />}
      </QueryView>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 24 },
  rowBase: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, paddingVertical: 4 },
  iconBtn: { width: TOUCH, height: TOUCH, alignItems: "center", justifyContent: "center" },
  iconBtnSm: { width: 36, height: 36, alignItems: "center", justifyContent: "center", marginVertical: -6 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  doneText: { textDecorationLine: "line-through", color: colors.muted },
  addItem: { flexDirection: "row", alignItems: "center", gap: 8, padding: 8, borderTopWidth: 1, borderTopColor: colors.border },
  inlineInput: {
    flex: 1,
    minHeight: TOUCH,
    paddingHorizontal: 10,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.foreground,
    backgroundColor: colors.surface2,
    borderRadius: radius.field,
  },
  mention: { paddingHorizontal: 8, minHeight: 32, justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.surface2 },
});
