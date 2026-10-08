// Brand Kit — the web's /studio/brand-kit (BrandKitClient.tsx).
// Data: GET/PATCH /api/studio/brand-kit (colors, fonts, guidelines);
// assets: upload() to /api/uploads → POST /api/studio/brand-kit/assets
// { name, url: "/uploads/…" }; DELETE /api/studio/brand-kit/assets/[id].

import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { Image } from "expo-image";

import { upload } from "@/api/client";
import { errorMessage } from "@/api/errors";
import { IconButton, Sheet } from "@/components/studio/shared";
import { pickDocument, pickImage } from "@/components/studio/pickFile";
import { Markdown } from "@/components/Markdown";
import { Button, Card, Field, PageHeader, Pill, QueryView, Screen, Text, useToast } from "@/components/ui";
import { useApiMutation, useApiQuery } from "@/hooks/useApi";
import { absoluteUrl } from "@/config/env";
import { openInBrowser } from "@/lib/links";
import { colors, radius, TOUCH } from "@/theme/tokens";
import type { BrandAsset, BrandAssetResponse, BrandColor, BrandFont, BrandKitDTO, BrandKitResponse, UploadResponse } from "@/types/studio";

const PATH = "/api/studio/brand-kit";
const HEX = /^#[0-9a-fA-F]{3,8}$/;
const isImage = (url: string) => /\.(png|jpe?g|gif|webp|svg)$/i.test(url);

function SectionCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text weight="semibold" accessibilityRole="header">{title}</Text>
        {action}
      </View>
      {children}
    </Card>
  );
}

function Editor({ initial }: { initial: BrandKitDTO }) {
  const toast = useToast();
  const [palette, setPalette] = useState<BrandColor[]>(initial.colors);
  const [fontList, setFontList] = useState<BrandFont[]>(initial.fonts);
  const [guidelines, setGuidelines] = useState(initial.guidelines);
  const [assets, setAssets] = useState<BrandAsset[]>(initial.assets);
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<BrandAsset | null>(null);

  const save = useApiMutation<BrandKitResponse>({ invalidates: [PATH], success: "Brand kit saved" });
  const linkAsset = useApiMutation<BrandAssetResponse>();
  const removeAsset = useApiMutation({ success: "Asset removed" });

  function onSave() {
    const clean = palette.filter((c) => HEX.test(c.hex));
    save.mutate(
      { path: PATH, method: "PATCH", body: { colors: clean, fonts: fontList, guidelines } },
      { onSuccess: ({ kit }) => setPalette(kit.colors) },
    );
  }

  async function uploadFrom(source: "photos" | "files") {
    let file;
    try {
      file = source === "photos" ? await pickImage() : await pickDocument();
    } catch (e) {
      toast(errorMessage(e), "error");
      return;
    }
    if (!file) return;
    setUploading(true);
    let stage: "upload" | "link" = "upload";
    try {
      const up = await upload<UploadResponse>("/api/uploads", file);
      stage = "link";
      const a = await linkAsset.mutateAsync({ path: `${PATH}/assets`, body: { name: file.name.slice(0, 200), url: up.url } });
      setAssets((list) => [...list, { id: a.id, name: a.name, url: a.url }]);
      toast("Asset uploaded");
    } catch (e) {
      // upload() isn't a mutation, so its errors aren't toasted for us.
      if (stage === "upload") toast(errorMessage(e), "error");
    } finally {
      setUploading(false);
    }
  }

  function chooseSource() {
    Alert.alert("Upload an asset", "PNG, JPEG, WebP, GIF or PDF, up to 25 MB.", [
      { text: "Photo library", onPress: () => void uploadFrom("photos") },
      { text: "Files", onPress: () => void uploadFrom("files") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function delAsset(a: BrandAsset) {
    Alert.alert("Remove this asset?", a.name, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          removeAsset.mutate(
            { path: `${PATH}/assets/${a.id}`, method: "DELETE" },
            {
              onSuccess: () => {
                setAssets((list) => list.filter((x) => x.id !== a.id));
                setViewing(null);
              },
            },
          ),
      },
    ]);
  }

  const setColor = (i: number, patch: Partial<BrandColor>) => setPalette((cs) => cs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setFont = (i: number, patch: Partial<BrandFont>) => setFontList((fs) => fs.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <>
      <PageHeader
        title="🪪 Brand Kit"
        subtitle="Your palette, fonts, logos, and guidelines — one source of truth for every post and cover."
        right={<Button title={save.isPending ? "Saving…" : "Save"} size="sm" onPress={onSave} loading={save.isPending} />}
      />

      <SectionCard
        title="Colour palette"
        action={
          <Button
            title="+ Colour"
            size="sm"
            variant="ghost"
            disabled={palette.length >= 24}
            onPress={() => setPalette((c) => [...c, { name: "", hex: "#8b5cf6" }])}
          />
        }
      >
        {palette.map((c, i) => {
          const valid = HEX.test(c.hex);
          return (
            <View key={i} style={s.row}>
              <View
                style={[s.swatch, { backgroundColor: valid ? c.hex : colors.surface2 }]}
                accessibilityLabel={valid ? `Colour ${c.hex}` : "Invalid colour"}
              />
              <View style={{ width: 108 }}>
                <Field
                  value={c.hex}
                  onChangeText={(t) => setColor(i, { hex: t })}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={9}
                  style={valid ? undefined : { borderColor: colors.danger }}
                  accessibilityLabel="Hex colour"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field value={c.name} onChangeText={(t) => setColor(i, { name: t })} placeholder="Name" maxLength={40} accessibilityLabel="Colour name" />
              </View>
              <IconButton icon="close" label="Remove colour" onPress={() => setPalette((cs) => cs.filter((_, j) => j !== i))} />
            </View>
          );
        })}
        {palette.length === 0 ? <Text variant="caption">No colours yet.</Text> : null}
        {palette.some((c) => !HEX.test(c.hex)) ? (
          <Text variant="caption" color={colors.warning}>Colours that aren’t valid hex codes (e.g. #8b5cf6) are dropped when you save.</Text>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Fonts"
        action={
          <Button
            title="+ Font"
            size="sm"
            variant="ghost"
            disabled={fontList.length >= 12}
            onPress={() => setFontList((f) => [...f, { name: "", usage: "" }])}
          />
        }
      >
        {fontList.map((f, i) => (
          <View key={i} style={s.row}>
            <View style={{ flex: 1, gap: 8 }}>
              <Field value={f.name} onChangeText={(t) => setFont(i, { name: t })} placeholder="Font name" maxLength={60} accessibilityLabel="Font name" />
              <Field
                value={f.usage}
                onChangeText={(t) => setFont(i, { usage: t })}
                placeholder="Usage (e.g. headings)"
                maxLength={60}
                accessibilityLabel="Font usage"
              />
            </View>
            <IconButton icon="close" label="Remove font" onPress={() => setFontList((fs) => fs.filter((_, j) => j !== i))} />
          </View>
        ))}
        {fontList.length === 0 ? <Text variant="caption">No fonts yet.</Text> : null}
      </SectionCard>

      <SectionCard
        title="Logos & assets"
        action={<Button title={uploading ? "Uploading…" : "+ Upload"} size="sm" variant="ghost" loading={uploading} onPress={chooseSource} />}
      >
        <View style={s.grid}>
          {assets.map((a) => (
            <Pressable
              key={a.id}
              accessibilityRole="button"
              accessibilityLabel={a.name}
              onPress={() => setViewing(a)}
              style={({ pressed }) => [s.asset, pressed && { borderColor: colors.brand }]}
            >
              {isImage(a.url) ? (
                <Image source={{ uri: absoluteUrl(a.url) }} style={s.assetImg} contentFit="contain" accessibilityIgnoresInvertColors />
              ) : (
                <View style={[s.assetImg, { alignItems: "center", justifyContent: "center" }]}>
                  <Text style={{ fontSize: 26 }}>📄</Text>
                </View>
              )}
              <Text style={{ fontSize: 10, lineHeight: 14 }} color={colors.muted} numberOfLines={1}>{a.name}</Text>
            </Pressable>
          ))}
        </View>
        {assets.length === 0 ? <Text variant="caption">No assets uploaded.</Text> : null}
      </SectionCard>

      <SectionCard title="Brand guidelines">
        <View style={{ flexDirection: "row", gap: 6 }} accessibilityRole="tablist">
          <Pill label="Write" active={!preview} onPress={() => setPreview(false)} />
          <Pill label="Preview" active={preview} onPress={() => setPreview(true)} />
        </View>
        {preview ? (
          guidelines.trim() ? <Markdown>{guidelines}</Markdown> : <Text variant="small">Nothing to preview.</Text>
        ) : (
          <Field
            value={guidelines}
            onChangeText={setGuidelines}
            multiline
            maxLength={20000}
            placeholder="Tone of voice, do's and don'ts, taglines…"
            style={{ minHeight: 180 }}
            accessibilityLabel="Brand guidelines"
          />
        )}
      </SectionCard>

      <Button title={save.isPending ? "Saving…" : "Save"} fullWidth onPress={onSave} loading={save.isPending} />

      {viewing ? (
        <Sheet visible title={viewing.name} onClose={() => setViewing(null)} error={removeAsset.error}>
          {isImage(viewing.url) ? (
            <Image source={{ uri: absoluteUrl(viewing.url) }} style={{ width: "100%", aspectRatio: 1, borderRadius: radius.card }} contentFit="contain" />
          ) : null}
          <Button title="Open" variant="ghost" fullWidth icon="globe" onPress={() => void openInBrowser(absoluteUrl(viewing.url))} />
          <Button title="Remove asset" variant="danger" fullWidth loading={removeAsset.isPending} onPress={() => delAsset(viewing)} />
        </Sheet>
      ) : null}
    </>
  );
}

export default function BrandKit() {
  // Not refetched in the background: this is an editing form, and a refetch
  // would otherwise race with unsaved edits.
  const query = useApiQuery<BrandKitResponse>(PATH, undefined, { staleTime: Infinity, refetchOnWindowFocus: false });
  return (
    <Screen>
      <Stack.Screen options={{ title: "Brand Kit" }} />
      <QueryView query={query}>{(d) => <Editor initial={d.kit} />}</QueryView>
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  swatch: { width: TOUCH, height: TOUCH, borderRadius: radius.field, borderWidth: 1, borderColor: colors.border },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  asset: {
    width: "31%",
    padding: 8,
    gap: 4,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  assetImg: { width: "100%", height: 64 },
});
