// Brand Kit — the web's /studio/brand-kit (BrandKitClient.tsx).
// Data: GET/PATCH /api/studio/brand-kit (colors, fonts, guidelines);
// assets: upload() to /api/uploads → POST /api/studio/brand-kit/assets
// { name, url: "/uploads/…" }; DELETE /api/studio/brand-kit/assets/[id].
// The web's <input type="color"> has no native equivalent in the app, so the
// swatch previews the hex value typed beside it.

import { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { Image } from "expo-image";

import { api, upload } from "@/api/client";
import { errorMessage } from "@/api/errors";
import { MarkdownEditor } from "@/components/studio/MarkdownEditor";
import { pickDocument, pickImage } from "@/components/studio/pickFile";
import { CardTitle, Input, RemoveButton } from "@/components/studio/shared";
import { Button, Card, PageHeader, QueryView, Screen, Text, useToast } from "@/components/ui";
import { absoluteUrl } from "@/config/env";
import { useApiQuery, useInvalidate } from "@/hooks/useApi";
import { colors, radius } from "@/theme/tokens";
import type { BrandAsset, BrandAssetResponse, BrandColor, BrandFont, BrandKitDTO, BrandKitResponse, UploadResponse } from "@/types/studio";

const PATH = "/api/studio/brand-kit";
const HEX = /^#[0-9a-fA-F]{3,8}$/;
const isImage = (url: string) => /\.(png|jpe?g|gif|webp|svg)$/i.test(url);

function SectionCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <CardTitle>{title}</CardTitle>
        {action}
      </View>
      {children}
    </Card>
  );
}

function Editor({ initial }: { initial: BrandKitDTO }) {
  const toast = useToast();
  const invalidate = useInvalidate();
  const [palette, setPalette] = useState<BrandColor[]>(initial.colors);
  const [fontList, setFontList] = useState<BrandFont[]>(initial.fonts);
  const [guidelines, setGuidelines] = useState(initial.guidelines);
  const [assets, setAssets] = useState<BrandAsset[]>(initial.assets);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function save() {
    if (saving) return;
    setSaving(true);
    setSaved(false);
    const clean = palette.filter((c) => HEX.test(c.hex));
    try {
      await api<BrandKitResponse>(PATH, { method: "PATCH", body: { colors: clean, fonts: fontList, guidelines } });
      setPalette(clean);
      setSaved(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setSaved(false), 1500);
      void invalidate(PATH);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setSaving(false);
    }
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
    try {
      const up = await upload<UploadResponse>("/api/uploads", file);
      const a = await api<BrandAssetResponse>(`${PATH}/assets`, { method: "POST", body: { name: file.name.slice(0, 200), url: up.url } });
      setAssets((list) => [...list, { id: a.id, name: a.name, url: a.url }]);
      void invalidate(PATH);
    } catch (e) {
      toast(errorMessage(e), "error");
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

  async function delAsset(id: string) {
    setAssets((a) => a.filter((x) => x.id !== id));
    try {
      await api(`${PATH}/assets/${id}`, { method: "DELETE" });
      void invalidate(PATH);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  const setColor = (i: number, patch: Partial<BrandColor>) => setPalette((cs) => cs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setFont = (i: number, patch: Partial<BrandFont>) => setFontList((fs) => fs.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <>
      <PageHeader
        title="🪪 Brand Kit"
        subtitle="Your palette, fonts, logos, and guidelines — one source of truth for every post and cover."
        right={<Button title={saving ? "Saving…" : saved ? "Saved ✓" : "Save"} onPress={() => void save()} disabled={saving} />}
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
        <View style={{ gap: 8 }}>
          {palette.map((c, i) => {
            const swatch = /^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : colors.brand; // the web color input falls back to #8b5cf6
            return (
              <View key={i} style={s.row}>
                <View style={[s.swatch, { backgroundColor: swatch }]} accessibilityLabel={`Colour ${c.hex}`} />
                <Input
                  value={c.hex}
                  onChangeText={(t) => setColor(i, { hex: t })}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={9}
                  style={{ width: 96, fontSize: 12 }}
                  accessibilityLabel="Hex colour"
                />
                <Input
                  value={c.name}
                  onChangeText={(t) => setColor(i, { name: t })}
                  placeholder="Name"
                  maxLength={40}
                  style={{ flex: 1, fontSize: 12 }}
                  accessibilityLabel="Colour name"
                />
                <RemoveButton label="Remove colour" onPress={() => setPalette((cs) => cs.filter((_, j) => j !== i))} />
              </View>
            );
          })}
          {palette.length === 0 ? <Text variant="caption">No colours yet.</Text> : null}
        </View>
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
        <View style={{ gap: 8 }}>
          {fontList.map((f, i) => (
            <View key={i} style={s.row}>
              <Input
                value={f.name}
                onChangeText={(t) => setFont(i, { name: t })}
                placeholder="Font name"
                maxLength={60}
                style={{ flex: 1 }}
                accessibilityLabel="Font name"
              />
              <Input
                value={f.usage}
                onChangeText={(t) => setFont(i, { usage: t })}
                placeholder="Usage (e.g. headings)"
                maxLength={60}
                style={{ flex: 1 }}
                accessibilityLabel="Font usage"
              />
              <RemoveButton label="Remove font" onPress={() => setFontList((fs) => fs.filter((_, j) => j !== i))} />
            </View>
          ))}
          {fontList.length === 0 ? <Text variant="caption">No fonts yet.</Text> : null}
        </View>
      </SectionCard>

      <SectionCard
        title="Logos & assets"
        action={<Button title={uploading ? "Uploading…" : "+ Upload"} size="sm" variant="ghost" disabled={uploading} onPress={chooseSource} />}
      >
        {assets.length === 0 ? (
          <Text variant="caption">No assets uploaded.</Text>
        ) : (
          <View style={s.grid}>
            {assets.map((a) => (
              <View key={a.id} style={s.asset}>
                {isImage(a.url) ? (
                  <Image source={{ uri: absoluteUrl(a.url) }} style={s.assetImg} contentFit="contain" accessibilityLabel={a.name} />
                ) : (
                  <View style={[s.assetImg, { alignItems: "center", justifyContent: "center" }]}>
                    <Text style={{ fontSize: 24, lineHeight: 32 }}>📄</Text>
                  </View>
                )}
                <Text style={{ fontSize: 10, lineHeight: 14, marginTop: 4 }} color={colors.muted} numberOfLines={1}>{a.name}</Text>
                <View style={s.assetRemove}>
                  <RemoveButton label={`Remove ${a.name}`} onPress={() => void delAsset(a.id)} size={12} />
                </View>
              </View>
            ))}
          </View>
        )}
      </SectionCard>

      <SectionCard title="Brand guidelines">
        <MarkdownEditor value={guidelines} onChange={setGuidelines} placeholder="Tone of voice, do's and don'ts, taglines…" />
      </SectionCard>
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
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  swatch: { width: 40, height: 32, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  asset: {
    width: "31.5%",
    padding: 8,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  assetImg: { width: "100%", height: 64 },
  assetRemove: { position: "absolute", top: -6, right: -2 },
});
