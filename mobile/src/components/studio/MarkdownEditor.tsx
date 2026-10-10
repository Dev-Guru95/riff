// Native port of the web's src/components/MarkdownEditor.tsx: a formatting
// toolbar (B, I, •, 1., ‹›, 🔗) plus Write / Preview tabs over a textarea.
// Preview uses the app's safe <Markdown> renderer (the web's renderMarkdown).

import { useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { Markdown } from "@/components/Markdown";
import { Text } from "@/components/ui";
import { colors, fonts, radius } from "@/theme/tokens";

function ToolButton({ label, title, onPress }: { label: string; title: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [s.tool, pressed && { backgroundColor: colors.border }]}
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
  maxLength = 20000,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  rows?: number;
  placeholder?: string;
  maxLength?: number;
}) {
  const ref = useRef<TextInput>(null);
  const sel = useRef({ start: value.length, end: value.length });
  const [tab, setTab] = useState<"write" | "preview">("write");

  function restore(start: number, end: number) {
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelection(start, end);
    });
  }

  function wrap(before: string, after: string, ph = "") {
    const { start: a, end: b } = sel.current;
    const s0 = Math.min(a, value.length);
    const e0 = Math.min(b, value.length);
    const picked = value.slice(s0, e0) || ph;
    onChange(value.slice(0, s0) + before + picked + after + value.slice(e0));
    restore(s0 + before.length, s0 + before.length + picked.length);
  }

  function linePrefix(prefix: string) {
    const at = Math.min(sel.current.start, value.length);
    const lineStart = value.lastIndexOf("\n", at - 1) + 1;
    onChange(value.slice(0, lineStart) + prefix + value.slice(lineStart));
    restore(at + prefix.length, at + prefix.length);
  }

  return (
    <View style={s.box}>
      <View style={s.bar}>
        <View style={s.tools}>
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
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t }}
              onPress={() => setTab(t)}
              style={s.tab}
            >
              <Text variant="caption" weight={tab === t ? "medium" : "regular"} color={tab === t ? colors.brand : colors.muted}>
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
          editable={!disabled}
          onChangeText={onChange}
          onSelectionChange={(e) => {
            sel.current = e.nativeEvent.selection;
          }}
          multiline
          maxLength={maxLength}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          selectionColor={colors.brand}
          accessibilityLabel={placeholder}
          style={[s.input, { minHeight: rows * 20 + 16 }, disabled && { opacity: 0.6 }]}
        />
      ) : (
        <View style={s.preview}>
          {value.trim() ? <Markdown>{value}</Markdown> : <Text style={{ opacity: 0.5 }}>Nothing to preview</Text>}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  box: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surface2 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 4,
  },
  tools: { flexDirection: "row", alignItems: "center", gap: 2, paddingVertical: 4, flexShrink: 1, flexWrap: "wrap" },
  tool: { minWidth: 32, minHeight: 32, paddingHorizontal: 8, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  tab: { paddingHorizontal: 8, minHeight: 36, justifyContent: "center" },
  input: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.regular,
    color: colors.foreground,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlignVertical: "top",
  },
  preview: { paddingHorizontal: 12, paddingVertical: 8, minHeight: 96 },
});
