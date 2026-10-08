// Native renderers for the two text formats the web uses. Both build React
// Native nodes directly (no HTML, no WebView), so content can never inject markup.
//
//  - <Markdown>    mirrors src/lib/markdown.ts (card descriptions, comments,
//                  brand guidelines, broadcasts): headings, lists, fenced code,
//                  **bold**, *italic*, `code`, and http(s)/mailto links only.
//  - <LessonText>  mirrors the lesson player: one paragraph per line, **bold** only.

import { Linking, StyleSheet, View } from "react-native";

import { colors, fonts } from "@/theme/tokens";
import { Text } from "./ui/Text";

type Inline = { text: string; bold?: boolean; italic?: boolean; code?: boolean; href?: string };

const SAFE_HREF = /^(https?:\/\/|mailto:)/i;

function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  // Order matters: links, code, bold, italic — like the web renderer.
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ text: src.slice(last, m.index) });
    if (m[1] !== undefined) {
      out.push(SAFE_HREF.test(m[2]!) ? { text: m[1], href: m[2] } : { text: m[0] });
    } else if (m[3] !== undefined) out.push({ text: m[3], code: true });
    else if (m[4] !== undefined || m[5] !== undefined) out.push({ text: (m[4] ?? m[5])!, bold: true });
    else out.push({ text: (m[6] ?? m[7])!, italic: true });
    last = re.lastIndex;
  }
  if (last < src.length) out.push({ text: src.slice(last) });
  return out;
}

function InlineText({ src, style }: { src: string; style?: object }) {
  return (
    <Text style={[styles.p, style]}>
      {parseInline(src).map((part, i) => (
        <Text
          key={i}
          onPress={part.href ? () => void Linking.openURL(part.href!) : undefined}
          accessibilityRole={part.href ? "link" : undefined}
          style={[
            part.bold && { fontFamily: fonts.bold },
            part.italic && { fontStyle: "italic" },
            part.code && styles.code,
            part.href && styles.link,
          ]}
        >
          {part.text}
        </Text>
      ))}
    </Text>
  );
}

type Block =
  | { kind: "h"; level: number; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "pre"; text: string };

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (/^```/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i]!)) buf.push(lines[i++]!);
      i++;
      blocks.push({ kind: "pre", text: buf.join("\n") });
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      blocks.push({ kind: "h", level: h[1]!.length, text: h[2]! });
      i++;
      continue;
    }
    const ul = /^[-*]\s+(.*)$/.exec(line);
    const ol = /^\d+\.\s+(.*)$/.exec(line);
    if (ul || ol) {
      const kind = ul ? "ul" : "ol";
      const prev = blocks[blocks.length - 1];
      const item = (ul ?? ol)![1]!;
      if (prev && prev.kind === kind) prev.items.push(item);
      else blocks.push({ kind, items: [item] });
      i++;
      continue;
    }
    if (line.trim() === "") {
      i++;
      continue;
    }
    const para = [line];
    i++;
    while (i < lines.length && lines[i]!.trim() !== "" && !/^(```|#{1,3}\s|[-*]\s|\d+\.\s)/.test(lines[i]!)) para.push(lines[i++]!);
    blocks.push({ kind: "p", text: para.join("\n") });
  }
  return blocks;
}

const H_SIZE = [18.4, 16.8, 15.7];

export function Markdown({ children }: { children: string }) {
  if (!children?.trim()) return null;
  return (
    <View style={styles.body}>
      {parseBlocks(children).map((b, i) => {
        if (b.kind === "h")
          return <InlineText key={i} src={b.text} style={{ fontFamily: fonts.semibold, fontSize: H_SIZE[b.level - 1], lineHeight: H_SIZE[b.level - 1]! * 1.35 }} />;
        if (b.kind === "pre")
          return (
            <View key={i} style={styles.pre}>
              <Text style={styles.preText}>{b.text}</Text>
            </View>
          );
        if ("items" in b)
          return (
            <View key={i} style={{ gap: 4 }}>
              {b.items.map((item, j) => (
                <View key={j} style={styles.li}>
                  <Text style={[styles.p, styles.bullet]}>{b.kind === "ul" ? "•" : `${j + 1}.`}</Text>
                  <View style={{ flex: 1 }}>
                    <InlineText src={item} />
                  </View>
                </View>
              ))}
            </View>
          );
        return <InlineText key={i} src={b.text} />;
      })}
    </View>
  );
}

/** Lesson body exactly as the web lesson player renders it. */
export function LessonText({ content }: { content: string }) {
  return (
    <View style={{ gap: 12 }}>
      {content
        .split("\n")
        .filter(Boolean)
        .map((p, i) => (
          <Text key={i} style={styles.lesson}>
            {p.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, j) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <Text key={j} style={{ fontFamily: fonts.bold }}>{part.slice(2, -2)}</Text>
              ) : (
                <Text key={j}>{part}</Text>
              ),
            )}
          </Text>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 8 },
  p: { fontSize: 14, lineHeight: 14 * 1.55, color: colors.foreground, fontFamily: fonts.regular },
  lesson: { fontSize: 16, lineHeight: 26, color: colors.foreground, fontFamily: fonts.regular },
  code: { fontFamily: fonts.medium, backgroundColor: colors.surface2, color: colors.accent },
  link: { color: colors.accent, textDecorationLine: "underline" },
  pre: { backgroundColor: colors.surface2, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: colors.border },
  preText: { fontSize: 13, lineHeight: 19, color: colors.foreground },
  li: { flexDirection: "row", gap: 8 },
  bullet: { color: colors.muted, minWidth: 14 },
});
