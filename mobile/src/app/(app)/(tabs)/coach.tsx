// AI Coach — the web's /coach page + CoachChat, as a native chat.
// Data: GET /api/mobile/coach (latest thread, or the community-locked state).
// Send: POST /api/coach/threads/:id/messages, streamed token by token (SSE).
// Feedback: PATCH /api/coach/messages/:id { feedback: "up" | "down" | null }.

import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { router } from "expo-router";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";

import { get } from "@/api/client";
import { ApiError, errorMessage } from "@/api/errors";
import { StreamUnavailableError, streamCoachReply } from "@/components/coach/coachStream";
import { Button, QueryView, Screen, Text, useToast } from "@/components/ui";
import { useApiMutation, useApiQuery, useInvalidate } from "@/hooks/useApi";
import { colors, fonts, gradients, radius, TOUCH, type as scale } from "@/theme/tokens";
import type { CoachMessageItem, CoachResponse } from "@/types/api";

type Msg = {
  id: string;
  role: string;
  content: string;
  feedback: "up" | "down" | null;
  /** Client-side error bubble (no feedback, optional action). */
  error?: "upgrade" | "generic";
};

const SUGGESTIONS = [
  "What should I focus on this week?",
  "Help me plan my next release",
  "How do I grow my fanbase?",
  "Review my branding strategy",
];

let msgSeq = 0;
const clientMsgId = (prefix: string) => `${prefix}-${msgSeq++}`;

const toMsg = (m: CoachMessageItem): Msg => ({
  id: m.id,
  role: m.role,
  content: m.content,
  feedback: m.feedback === "up" || m.feedback === "down" ? m.feedback : null,
});

export default function Coach() {
  const query = useApiQuery<CoachResponse>("/api/mobile/coach");
  return (
    <QueryView query={query}>
      {(d) =>
        d.locked ? (
          <CoachLocked pending={d.pending} onRefresh={query.refetch} />
        ) : (
          <CoachChat key={d.thread.id} threadId={d.thread.id} initial={d.messages} stageName={d.stageName} />
        )
      }
    </QueryView>
  );
}

function CoachLocked({ pending, onRefresh }: { pending: boolean; onRefresh: () => Promise<unknown> }) {
  return (
    <Screen onRefresh={onRefresh}>
      <View style={{ alignItems: "center", paddingVertical: 48 }}>
        <Text style={{ fontSize: 48, lineHeight: 56, marginBottom: 12 }}>🔒</Text>
        <Text variant="title" style={{ textAlign: "center" }}>AI Artist Coach</Text>
        <Text variant="small" style={[scale.base, { textAlign: "center", maxWidth: 340, marginTop: 8 }]}>
          A coach that knows your goals, genre, progress and audit scores. It unlocks when you join the SoundRig community on Skool.
        </Text>
        {pending ? (
          <Text style={{ textAlign: "center", marginTop: 24 }}>
            ⏳ Your membership is being verified — your coach unlocks as soon as it&apos;s approved.
          </Text>
        ) : (
          <Button title="Join the community to unlock" onPress={() => router.push("/community")} style={{ alignSelf: "center", marginTop: 24 }} />
        )}
      </View>
    </Screen>
  );
}

function FeedbackButtons({ message, onChange }: { message: Msg; onChange: (f: Msg["feedback"]) => void }) {
  const mutation = useApiMutation();
  function rate(value: "up" | "down") {
    const next = message.feedback === value ? null : value;
    const prev = message.feedback;
    onChange(next);
    void Haptics.selectionAsync().catch(() => {});
    mutation.mutate(
      { path: `/api/coach/messages/${message.id}`, method: "PATCH", body: { feedback: next } },
      { onError: () => onChange(prev) },
    );
  }
  return (
    <View style={styles.feedback}>
      {(["up", "down"] as const).map((v) => (
        <Pressable
          key={v}
          onPress={() => rate(v)}
          accessibilityRole="button"
          accessibilityLabel={v === "up" ? "Helpful" : "Not helpful"}
          accessibilityState={{ selected: message.feedback === v }}
          hitSlop={6}
          style={styles.feedbackBtn}
        >
          <Text style={{ fontSize: 12, lineHeight: 16, opacity: message.feedback === v ? 1 : 0.4 }}>{v === "up" ? "👍" : "👎"}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Bubble({ m, onFeedback }: { m: Msg; onFeedback: (id: string, f: Msg["feedback"]) => void }) {
  const toast = useToast();
  const mine = m.role === "user";
  const copy = async () => {
    if (!m.content) return;
    await Clipboard.setStringAsync(m.content);
    toast("Copied", "info");
  };
  return (
    <View style={[styles.row, { alignItems: mine ? "flex-end" : "flex-start" }]}>
      <Pressable onLongPress={copy} accessibilityHint="Long press to copy" style={{ maxWidth: "80%" }}>
        {mine ? (
          <LinearGradient {...gradients.brand} style={[styles.bubble, styles.mine]}>
            <Text color={colors.white} style={styles.bubbleText}>{m.content}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.bubble, styles.theirs]}>
            <Text style={styles.bubbleText}>{m.content || " "}</Text>
          </View>
        )}
      </Pressable>
      {m.error === "upgrade" ? (
        <Button title="See plans" size="sm" variant="ghost" icon="card" onPress={() => router.push("/pricing")} style={{ marginTop: 6 }} />
      ) : null}
      {m.role === "assistant" && !m.error && !m.id.startsWith("a-") ? (
        <FeedbackButtons message={m} onChange={(f) => onFeedback(m.id, f)} />
      ) : null}
    </View>
  );
}

function CoachChat({ threadId, initial, stageName }: { threadId: string; initial: CoachMessageItem[]; stageName: string | null }) {
  const invalidate = useInvalidate();
  const [messages, setMessages] = useState<Msg[]>(() => initial.filter((m) => m.role !== "system").map(toMsg));
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const listRef = useRef<FlashListRef<Msg>>(null);
  const atBottom = useRef(true);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    atBottom.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 80;
  }, []);

  const scrollToEnd = useCallback(() => {
    if (atBottom.current) requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const setFeedback = useCallback((id: string, feedback: Msg["feedback"]) => {
    setMessages((list) => list.map((m) => (m.id === id ? { ...m, feedback } : m)));
  }, []);

  /** Non-streamed fallback: both messages are saved before streaming, so reload them. */
  async function reloadFromServer() {
    const res = await get<{ messages: CoachMessageItem[] }>(`/api/coach/threads/${threadId}/messages`);
    setMessages(res.messages.filter((m) => m.role !== "system").map(toMsg));
  }

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || loading) return;
    atBottom.current = true;
    setMessages((m) => [...m, { id: clientMsgId("u"), role: "user", content: text, feedback: null }]);
    setInput("");
    setLoading(true);
    let msgId = clientMsgId("a");
    let acc = "";
    let started = false;
    try {
      await streamCoachReply(threadId, text, {
        onId: (id) => {
          msgId = id;
          if (!started) {
            started = true;
            setStreaming(true);
            setMessages((m) => [...m, { id, role: "assistant", content: "", feedback: null }]);
          }
        },
        onDelta: (delta) => {
          acc += delta;
          const content = acc;
          setMessages((m) => m.map((x) => (x.id === msgId ? { ...x, content } : x)));
        },
      });
    } catch (err) {
      if (err instanceof StreamUnavailableError) {
        try {
          await reloadFromServer();
        } catch (e) {
          setMessages((m) => [...m, { id: clientMsgId("e"), role: "assistant", content: errorMessage(e), feedback: null, error: "generic" }]);
        }
      } else {
        const apiErr = err instanceof ApiError ? err : null;
        if (apiErr?.status === 403 && apiErr.body?.reason === "community_required") {
          void invalidate("/api/mobile/coach"); // flips the screen to the locked state
        }
        // Like the web: the error appears as a coach bubble (the server's own text
        // for quota / rate limits / validation).
        const content = apiErr && !["network", "timeout", "server"].includes(apiErr.kind) ? apiErr.message : errorMessage(err);
        setMessages((m) => [
          ...m,
          { id: clientMsgId("e"), role: "assistant", content, feedback: null, error: apiErr?.status === 402 ? "upgrade" : "generic" },
        ]);
      }
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  }

  const disabled = loading || !input.trim();

  return (
    <KeyboardAvoidingView behavior="padding" automaticOffset style={styles.root}>
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">🤖 AI Artist Coach</Text>
        <Text variant="small">Personalized to {stageName ?? "you"} — knows your goals, genre, progress, and audit scores.</Text>
      </View>

      {/* The web renders the thread and the composer inside one .card. */}
      <View style={styles.chatCard}>
        <FlashList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <Bubble m={item} onFeedback={setFeedback} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 36, lineHeight: 40, marginBottom: 12 }}>👋</Text>
              <Text variant="small" style={[scale.base, { textAlign: "center", marginBottom: 16 }]}>Ask me anything about growing your music career.</Text>
              <View style={styles.suggestions}>
                {SUGGESTIONS.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => void send(s)}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.suggestion, pressed && { backgroundColor: colors.border }]}
                  >
                    <Text variant="caption" color={colors.foreground}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          }
          ListFooterComponent={
            loading && !streaming ? (
              <View style={[styles.row, { alignItems: "flex-start" }]}>
                <View style={[styles.bubble, styles.theirs, { paddingVertical: 12 }]}>
                  <Text variant="small">Coach is thinking…</Text>
                </View>
              </View>
            ) : null
          }
          contentContainerStyle={styles.listContent}
          maintainVisibleContentPosition={{ startRenderingFromBottom: true, autoscrollToBottomThreshold: 0.2 }}
          onScroll={onScroll}
          scrollEventThrottle={64}
          onContentSizeChange={scrollToEnd}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        />

        <View style={styles.composer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Message your coach…"
            placeholderTextColor={colors.muted}
            selectionColor={colors.brand}
            editable={!loading}
            multiline
            maxLength={2000}
            style={styles.input}
            accessibilityLabel="Message your coach"
          />
          <Pressable
            onPress={() => void send(input)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Send"
            accessibilityState={{ disabled }}
            style={({ pressed }) => [styles.sendBtn, { opacity: disabled ? 0.45 : pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          >
            <LinearGradient {...gradients.brand} style={styles.sendGradient}>
              <Text style={styles.sendText}>Send</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  header: { gap: 2, marginBottom: 16 },
  chatCard: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    overflow: "hidden",
  },
  listContent: { padding: 16 },
  row: { marginBottom: 16 },
  bubble: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16 },
  mine: { borderBottomRightRadius: 2 },
  theirs: { backgroundColor: colors.surface2, borderBottomLeftRadius: 2 },
  bubbleText: { fontSize: 14, lineHeight: 23 },
  feedback: { flexDirection: "row", gap: 4, marginTop: 4, marginLeft: 4 },
  feedbackBtn: { minWidth: 32, minHeight: 32, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingVertical: 32 },
  suggestions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  suggestion: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: TOUCH,
    maxHeight: 140,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.foreground,
  },
  sendBtn: { height: TOUCH, borderRadius: radius.pill, overflow: "hidden" },
  sendGradient: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  sendText: { fontFamily: fonts.semibold, fontSize: 14.4, color: colors.white },
});
