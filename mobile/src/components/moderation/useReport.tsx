// Reporting and blocking, as one hook both the AI Coach and board comments use.
//
// Both stores require this to be reachable from inside the app:
//   - Google Play's Generative AI policy: an app that generates content with AI
//     must let people report offensive output without leaving the app. That is
//     the ⚑ under every AI Coach reply.
//   - App Store guideline 1.2: anywhere one artist reads another artist's
//     words, there must be a way to report the content AND block its author.
//     That is Report / Block in the ⋯ menu on a card comment.
//
// Both write to POST /api/community/report, which lands in the same moderation
// queue staff already work from (/admin/moderation). Blocking toggles through
// POST /api/community/block; the server then hides that artist's comments.
//
// Usage: `const report = useReport()` → render `{report.element}` somewhere in
// the screen, then call `report.show({ ... })`.

import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { post } from "@/api/client";
import { errorMessage } from "@/api/errors";
import { Button, Field, Icon, Modal, Text, useToast } from "@/components/ui";
import { REPORT_REASONS, type ReportReasonKey } from "@/lib/constants";
import { colors, radius, TOUCH } from "@/theme/tokens";

/** The three surfaces a person can report from the app. */
export type ReportTargetType = "coach_message" | "comment" | "user";

export type ReportTarget = {
  targetType: ReportTargetType;
  targetId: string;
  /** Dialog heading, e.g. "Report this AI Coach reply". */
  title: string;
  /** The artist who wrote it, when a person did. Null for AI output. */
  authorId?: string | null;
  authorName?: string;
};

/** Toggle a block. Returns the new state, or undefined if the call failed. */
export async function toggleBlock(userId: string): Promise<boolean | undefined> {
  const res = await post<{ blocked: boolean }>("/api/community/block", { blockedId: userId });
  return res?.blocked;
}

export function useReport() {
  const [target, setTarget] = useState<ReportTarget | null>(null);
  const show = useCallback((t: ReportTarget) => setTarget(t), []);
  const close = useCallback(() => setTarget(null), []);
  const element = target ? <ReportDialog key={target.targetId} target={target} onClose={close} /> : null;
  return { show, close, element };
}

function ReportDialog({ target, onClose }: { target: ReportTarget; onClose: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState<ReportReasonKey | null>(null);
  const [detail, setDetail] = useState("");
  const [sending, setSending] = useState(false);

  // "Something else" is only useful if the reporter can say what else it is.
  const needsDetail = reason === "other";
  const ready = reason !== null && (!needsDetail || detail.trim().length >= 3);

  async function submit() {
    if (!ready || sending) return;
    setSending(true);
    try {
      const res = await post<{ duplicate: boolean; authorId: string | null }>("/api/community/report", {
        targetType: target.targetType,
        targetId: target.targetId,
        reason,
        detail: detail.trim() || undefined,
      });
      onClose();
      toast(
        res?.duplicate
          ? "You already reported this — it's with our moderators."
          : "Thanks. Our moderators will review this.",
      );
      // Reporting a person's content is the natural moment to offer the block.
      const authorId = res?.authorId ?? target.authorId ?? null;
      if (authorId) offerBlock(authorId, target.authorName, toast);
    } catch (err) {
      setSending(false);
      Alert.alert("Couldn't send that report", errorMessage(err));
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={styles.wrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <View style={styles.dialog} accessibilityViewIsModal>
          <Text variant="heading" accessibilityRole="header">{target.title}</Text>
          <Text variant="small">
            Tell us what is wrong with it. Reports go to our moderators, who can remove the content
            {target.targetType === "coach_message" ? " and retrain the coach" : " and suspend the account"}.
          </Text>

          <View style={styles.reasons} accessibilityRole="radiogroup">
            {REPORT_REASONS.map((r) => {
              const selected = reason === r.key;
              return (
                <Pressable
                  key={r.key}
                  onPress={() => setReason(r.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={({ pressed }) => [styles.reason, selected && styles.reasonOn, pressed && { opacity: 0.7 }]}
                >
                  <Icon name={selected ? "check" : "flag"} size={16} color={selected ? colors.brand : colors.muted} />
                  <Text style={{ flex: 1 }} color={selected ? colors.foreground : colors.muted}>{r.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Field
            value={detail}
            onChangeText={setDetail}
            placeholder={needsDetail ? "What is wrong with it?" : "Anything else we should know? (optional)"}
            multiline
            maxLength={500}
            editable={!sending}
            accessibilityLabel="More detail"
          />

          <View style={styles.actions}>
            <Button title="Cancel" variant="ghost" size="sm" onPress={onClose} disabled={sending} />
            <Button
              title={sending ? "Sending…" : "Send report"}
              size="sm"
              variant="destructive"
              loading={sending}
              disabled={!ready}
              onPress={() => void submit()}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** After reporting a person, offer to stop seeing them too. */
function offerBlock(authorId: string, authorName: string | undefined, toast: ReturnType<typeof useToast>) {
  const who = authorName ?? "this artist";
  Alert.alert(`Also block ${who}?`, `You won't see ${who}'s comments any more. You can undo this at any time.`, [
    { text: "Not now", style: "cancel" },
    {
      text: "Block",
      style: "destructive",
      onPress: () => {
        void toggleBlock(authorId)
          .then((blocked) => toast(blocked ? `${who} blocked` : `${who} unblocked`))
          .catch((err: unknown) => toast(errorMessage(err), "error"));
      },
    },
  ]);
}

/** The Block / Unblock action for a menu, with its own confirmation. */
export function confirmBlock(authorName: string, authorId: string, onDone: (blocked: boolean) => void) {
  Alert.alert(`Block ${authorName}?`, `You won't see ${authorName}'s comments any more. You can undo this at any time.`, [
    { text: "Cancel", style: "cancel" },
    {
      text: "Block",
      style: "destructive",
      onPress: () => {
        void toggleBlock(authorId)
          .then((blocked) => onDone(blocked ?? false))
          .catch((err: unknown) => Alert.alert("Couldn't block them", errorMessage(err)));
      },
    },
  ]);
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.overlay, justifyContent: "center", padding: 24 },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 12,
  },
  reasons: { gap: 2 },
  reason: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: TOUCH,
    paddingHorizontal: 10,
    borderRadius: radius.md,
  },
  reasonOn: { backgroundColor: colors.surface2 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
});
