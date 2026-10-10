// Caption & Hashtag Generator — the web's /studio/caption (CaptionClient.tsx).
// Data: POST /api/studio/caption { topic, platform, tone } → { captions, hashtags }.

import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import * as Clipboard from "expo-clipboard";

import { Input, Select, SubHeading } from "@/components/studio/shared";
import { Button, Card, PageHeader, Screen, Text } from "@/components/ui";
import { useApiMutation } from "@/hooks/useApi";
import { colors, radius } from "@/theme/tokens";
import { CAPTION_PLATFORMS, CAPTION_TONES, type CaptionResult } from "@/types/studio";

// The web's <select> shows the raw lowercase value with CSS `capitalize`.
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const PLATFORM_OPTIONS = CAPTION_PLATFORMS.map((p) => ({ value: p, label: cap(p) }));
const TONE_OPTIONS = CAPTION_TONES.map((t) => ({ value: t, label: cap(t) }));

export default function Caption() {
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<string>("instagram");
  const [tone, setTone] = useState<string>("authentic");
  const [result, setResult] = useState<CaptionResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gen = useApiMutation<CaptionResult>({ onSuccess: setResult });

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy(text: string, key: string) {
    await Clipboard.setStringAsync(text);
    setCopied(key);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 1200);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: "Caption Generator" }} />
      <PageHeader title="✍️ Caption & Hashtag Generator" subtitle="Describe your post — get scroll-stopping captions and hashtags." />

      <Card style={{ gap: 8 }}>
        <Input
          look="field"
          value={topic}
          onChangeText={setTopic}
          multiline
          maxLength={500}
          style={{ minHeight: 84, borderRadius: radius.md, fontSize: 14 }}
          placeholder="What's the post about? (e.g. teaser for my new synthwave single 'Neon Drive')"
          accessibilityLabel="What's the post about?"
        />
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <Select look="field" accessibilityLabel="Platform" options={PLATFORM_OPTIONS} value={platform} onChange={setPlatform} />
          <Select look="field" accessibilityLabel="Tone" options={TONE_OPTIONS} value={tone} onChange={setTone} />
          <Button
            title={gen.isPending ? "Generating…" : "Generate"}
            style={{ marginLeft: "auto" }}
            disabled={gen.isPending || !topic.trim()}
            onPress={() => gen.mutate({ path: "/api/studio/caption", body: { topic, platform, tone } })}
          />
        </View>
      </Card>

      {result ? (
        <>
          <View style={{ gap: 8 }}>
            <SubHeading>Captions</SubHeading>
            {result.captions.map((c, i) => (
              <Card key={i} style={{ padding: 12, flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <Text selectable style={{ flex: 1 }}>{c}</Text>
                <Button
                  title={copied === `c${i}` ? "Copied ✓" : "Copy"}
                  size="sm"
                  variant="ghost"
                  onPress={() => void copy(c, `c${i}`)}
                  accessibilityLabel={`Copy caption ${i + 1}`}
                />
              </Card>
            ))}
          </View>
          <View style={{ gap: 8 }}>
            <SubHeading>Hashtags</SubHeading>
            <Card style={{ padding: 12, gap: 8 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {result.hashtags.map((h, i) => (
                  <View key={i} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surface2 }}>
                    <Text variant="caption" color={colors.accent}>{h}</Text>
                  </View>
                ))}
              </View>
              <Button
                title={copied === "tags" ? "Copied ✓" : "Copy all"}
                size="sm"
                variant="ghost"
                onPress={() => void copy(result.hashtags.join(" "), "tags")}
              />
            </Card>
          </View>
        </>
      ) : null}
    </Screen>
  );
}
