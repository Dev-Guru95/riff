// Caption & Hashtag Generator — the web's /studio/caption (CaptionClient.tsx).
// Data: POST /api/studio/caption { topic, platform, tone } → { captions, hashtags }.

import { useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import * as Clipboard from "expo-clipboard";

import { OptionPills } from "@/components/studio/shared";
import { Button, Card, Field, PageHeader, Screen, Section, Text, useToast } from "@/components/ui";
import { useApiMutation } from "@/hooks/useApi";
import { colors, radius } from "@/theme/tokens";
import { CAPTION_PLATFORMS, CAPTION_TONES, type CaptionResult } from "@/types/studio";

export default function Caption() {
  const toast = useToast();
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState<string>("instagram");
  const [tone, setTone] = useState<string>("authentic");
  const [result, setResult] = useState<CaptionResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const gen = useApiMutation<CaptionResult>({ onSuccess: setResult });

  async function copy(text: string, key: string) {
    await Clipboard.setStringAsync(text);
    setCopied(key);
    toast("Copied");
    setTimeout(() => setCopied((k) => (k === key ? null : k)), 1200);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: "Caption Generator" }} />
      <PageHeader title="✍️ Caption & Hashtag Generator" subtitle="Describe your post — get scroll-stopping captions and hashtags." />

      <Card style={{ gap: 14 }}>
        <Field
          value={topic}
          onChangeText={setTopic}
          multiline
          maxLength={500}
          placeholder="What's the post about? (e.g. teaser for my new synthwave single 'Neon Drive')"
          accessibilityLabel="What's the post about?"
        />
        <OptionPills title="Platform" options={CAPTION_PLATFORMS} value={platform} onChange={setPlatform} />
        <OptionPills title="Tone" options={CAPTION_TONES} value={tone} onChange={setTone} />
        <Button
          title={gen.isPending ? "Generating…" : "Generate"}
          fullWidth
          loading={gen.isPending}
          disabled={!topic.trim()}
          onPress={() => gen.mutate({ path: "/api/studio/caption", body: { topic, platform, tone } })}
        />
      </Card>

      {result ? (
        <>
          <Section title="Captions">
            {result.captions.map((c, i) => (
              <Card key={i} style={{ gap: 8 }}>
                <Text selectable>{c}</Text>
                <Button
                  title={copied === `c${i}` ? "Copied ✓" : "Copy"}
                  size="sm"
                  variant="ghost"
                  onPress={() => void copy(c, `c${i}`)}
                  accessibilityLabel={`Copy caption ${i + 1}`}
                />
              </Card>
            ))}
          </Section>
          <Section title="Hashtags">
            <Card style={{ gap: 10 }}>
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
          </Section>
        </>
      ) : null}
    </Screen>
  );
}
