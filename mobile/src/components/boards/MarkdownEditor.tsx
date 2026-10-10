// Native port of the web's src/components/MarkdownEditor.tsx: a formatting
// toolbar (B, I, •, 1., ‹›, 🔗) and Write / Preview tabs. Preview uses the app's
// safe <Markdown> renderer (mirrors src/lib/markdown.ts).

import { useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Markdown } from "@/components/Markdown";
import { Text } from "@/components/ui";
import { colors, fonts, radius } from "@/theme/tokens";

function ToolButton({ label, title, onPress }: { label: string; title: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      hitSlop={4}
      style={({ pressed }) => [styles.tool, pressed && { backgroundColor: colors.border }]}
    >
      <Text variant="caption">{label}</Text>
    </Pressable>
  );
}

export function MarkdownEditor({
  value,
  onChange,
  disabled,
  rows = 6,
  placeholder,
  maxLength,
  accessibilityLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  rows?: number;
  placeholder?: string;
  maxLength?: number;
  accessibilityLabel?: string;
}) {
  const ref = useRef<TextInput>(null);
  const sel = useRef({ start: value.length, end: value.length });
  const [tab, setTab] = useState<"write" | "preview">("write");

  const range = () => {
    const s = Math.min(sel.current.start, value.length);
    const e = Math.min(Math.max(sel.current.end, s), value.length);
    return { s, e };
  };

  function wrap(before: string, after: string, ph = "") {
    const { s, e } = range();
    const chosen = value.slice(s, e) || ph;
    onChange(value.slice(0, s) + before + chosen + after + value.slice(e));
    const end = s + before.length + chosen.length + after.length;
    sel.current = { start: end, end };
    ref.current?.focus();
  }

  function linePrefix(prefix: string) {
    const { s } = range();
    const lineStart = value.lastIndexOf("\n", s - 1) + 1;
    onChange(value.slice(0, lineStart) + prefix + value.slice(lineStart));
    sel.current = { start: s + prefix.length, end: s + prefix.length };
    ref.current?.focus();
  }

  return (
    <View style={styles.box}>
      <View style={styles.bar}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 2, flex: 1 }}>
          {!disabled && tab === "write" ? (
            <>
              <ToolButton label="B" title="Bold" onPress={() => wrap("**", "**", "bold")} />
              <ToolButton label="I" title="Italic" onPress={() => wrap("_", "_", "italic")} />
              <ToolButton label="•" title="Bulleted list" onPress={() => linePrefix("- ")} />
              <ToolButton label="1." title="Numbered list" onPress={() => linePrefix("1. ")} />
              <ToolButton label="‹›" title="Code" onPress={() => wrap("`", "`", "code")} />
              <ToolButton label="🔗" title="Link" onPress={() => wrap("[", "](https://)", "text")} />
            </>
          ) : null}
        </View>
        <View style={{ flexDirection: "row" }} accessibilityRole="tablist">
          {(["write", "preview"] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t }}
              style={styles.tab}
            >
              <Text variant="caption" color={tab === t ? colors.brand : colors.muted} weight={tab === t ? "medium" : undefined}>
                {t === "write" ? "Write" : "Preview"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {tab === "write" ? (
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChange}
          onSelectionChange={(e) => {
            sel.current = e.nativeEvent.selection;
          }}
          editable={!disabled}
          multiline
          maxLength={maxLength}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          selectionColor={colors.brand}
          accessibilityLabel={accessibilityLabel ?? placeholder}
          style={[styles.input, { minHeight: rows * 20 + 16 }, disabled && { opacity: 0.6 }]}
        />
      ) : (
        <View style={styles.preview}>
          {value.trim() ? <Markdown>{value}</Markdown> : <Text style={{ opacity: 0.5 }}>Nothing to preview</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surface2 },
  bar: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 4, minHeight: 40 },
  tool: { minWidth: 32, height: 32, paddingHorizontal: 6, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  tab: { paddingHorizontal: 8, minHeight: 40, justifyContent: "center" },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.foreground,
    textAlignVertical: "top",
  },
  preview: { paddingHorizontal: 12, paddingVertical: 8, minHeight: 96 },
});
