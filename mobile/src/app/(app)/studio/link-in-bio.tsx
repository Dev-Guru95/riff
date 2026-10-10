// Link-in-Bio — the web's /studio/link-in-bio (LinkInBioClient.tsx). The web's
// editor and preview columns stack at phone width.
// Data: GET/PATCH /api/studio/link-page. The public page (/u/[handle]) is a web
// page with no native screen, so "View live" opens it in the in-app browser.

import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";

import { api } from "@/api/client";
import { errorMessage } from "@/api/errors";
import { FieldLabel, Input, RemoveButton } from "@/components/studio/shared";
import { Button, Card, QueryView, Screen, Text } from "@/components/ui";
import { absoluteUrl } from "@/config/env";
import { useApiQuery, useInvalidate } from "@/hooks/useApi";
import { openInBrowser } from "@/lib/links";
import { colors, fonts, radius } from "@/theme/tokens";
import { LINK_THEMES, type LinkItem, type LinkPageDTO, type LinkPageResponse } from "@/types/studio";

const PATH = "/api/studio/link-page";
const THEME_COLOR: Record<string, string> = {
  brand: colors.brand,
  "brand-2": colors.brand2,
  accent: colors.accent,
  success: colors.success,
  warning: colors.warning,
};

function Editor({ initial }: { initial: LinkPageDTO }) {
  const invalidate = useInvalidate();
  const [p, setP] = useState<LinkPageDTO>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const themeColor = THEME_COLOR[p.theme] ?? colors.brand;

  function set<K extends keyof LinkPageDTO>(k: K, v: LinkPageDTO[K]) {
    setP((prev) => ({ ...prev, [k]: v }));
  }
  function setLink(i: number, item: LinkItem) {
    setP((prev) => ({ ...prev, links: prev.links.map((l, j) => (j === i ? item : l)) }));
  }

  // Always send the full current payload so unsaved edits aren't clobbered by
  // the server echoing the last-saved page (same as the web).
  async function save(published?: boolean) {
    if (saving) return;
    setSaving(true);
    setErr(null);
    try {
      const { page } = await api<LinkPageResponse>(PATH, {
        method: "PATCH",
        body: { handle: p.handle, title: p.title, bio: p.bio, theme: p.theme, links: p.links, ...(published === undefined ? {} : { published }) },
      });
      setP(page);
      setSaved(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setSaved(false), 1500);
      void invalidate(PATH);
    } catch (e) {
      setErr(errorMessage(e) || "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <View>
        <View style={s.headRow}>
          <Text variant="title" accessibilityRole="header" style={{ flexShrink: 1 }}>🔗 Link-in-Bio</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button title={saving ? "Saving…" : saved ? "Saved ✓" : "Save"} variant="ghost" disabled={saving} onPress={() => void save()} />
            <Button title={p.published ? "Unpublish" : "Publish"} variant={p.published ? "ghost" : "primary"} onPress={() => void save(!p.published)} />
          </View>
        </View>
        <Text variant="small" style={{ marginTop: 4 }}>
          Your public landing page for every link.{" "}
          {p.published ? (
            <Text
              variant="small"
              color={colors.accent}
              style={{ textDecorationLine: "underline" }}
              accessibilityRole="link"
              suppressHighlighting
              onPress={() => void openInBrowser(absoluteUrl(`/u/${encodeURIComponent(p.handle)}`))}
            >
              View live → /u/{p.handle}
            </Text>
          ) : (
            <Text variant="small" color={colors.warning}>Not published yet.</Text>
          )}
        </Text>
        {err ? <Text color={colors.brand2} style={{ marginTop: 4 }} accessibilityLiveRegion="polite">{err}</Text> : null}
      </View>

      {/* Editor */}
      <View style={{ gap: 12 }}>
        <View style={{ gap: 4 }}>
          <FieldLabel>Handle</FieldLabel>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text variant="small">/u/</Text>
            <Input
              value={p.handle}
              onChangeText={(t) => set("handle", t)}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
              accessibilityLabel="Handle"
              style={{ flex: 1 }}
            />
          </View>
        </View>
        <View style={{ gap: 4 }}>
          <FieldLabel>Title</FieldLabel>
          <Input value={p.title} onChangeText={(t) => set("title", t)} maxLength={80} accessibilityLabel="Title" />
        </View>
        <View style={{ gap: 4 }}>
          <FieldLabel>Bio</FieldLabel>
          <Input value={p.bio} onChangeText={(t) => set("bio", t)} multiline maxLength={500} style={{ minHeight: 56 }} accessibilityLabel="Bio" />
        </View>
        <View style={{ gap: 4 }}>
          <FieldLabel>Theme</FieldLabel>
          <View style={{ flexDirection: "row", gap: 6 }} accessibilityRole="radiogroup">
            {LINK_THEMES.map((t) => {
              const on = p.theme === t;
              return (
                <Pressable
                  key={t}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`Theme ${t}`}
                  onPress={() => set("theme", t)}
                  hitSlop={8}
                  style={s.themeHit}
                >
                  <View style={[s.themeDot, { backgroundColor: THEME_COLOR[t] }, on && s.themeOn]} />
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <FieldLabel>Links</FieldLabel>
            <Button
              title="+ Link"
              size="sm"
              variant="ghost"
              disabled={p.links.length >= 30}
              onPress={() => set("links", [...p.links, { label: "", url: "https://" }])}
            />
          </View>
          <View style={{ gap: 8 }}>
            {p.links.map((l, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Input
                  value={l.label}
                  onChangeText={(t) => setLink(i, { ...l, label: t })}
                  placeholder="Label"
                  maxLength={60}
                  accessibilityLabel="Link label"
                  style={{ width: 112 }}
                />
                <Input
                  value={l.url}
                  onChangeText={(t) => setLink(i, { ...l, url: t })}
                  placeholder="https://"
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={500}
                  accessibilityLabel="Link URL"
                  style={{ flex: 1 }}
                />
                <RemoveButton label="Remove link" onPress={() => set("links", p.links.filter((_, j) => j !== i))} />
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Preview */}
      <View style={{ gap: 4 }}>
        <FieldLabel>Preview</FieldLabel>
        <Card style={{ alignItems: "center", borderTopColor: themeColor, borderTopWidth: 3, padding: 20 }}>
          <View style={[s.avatar, { backgroundColor: themeColor }]}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 24, lineHeight: 30 }} color={colors.white}>
              {(p.title || "A")[0]?.toUpperCase()}
            </Text>
          </View>
          <Text weight="bold" style={{ marginTop: 8, textAlign: "center" }}>{p.title || "Your name"}</Text>
          <Text variant="caption" style={{ marginTop: 4, textAlign: "center" }}>{p.bio || "Your bio…"}</Text>
          <View style={{ alignSelf: "stretch", gap: 8, marginTop: 16 }}>
            {p.links
              .filter((l) => l.url)
              .map((l, i) => (
                <View key={i} style={[s.previewLink, { borderColor: themeColor }]}>
                  <Text numberOfLines={1}>{l.label || l.url}</Text>
                </View>
              ))}
            {p.links.length === 0 ? <Text variant="caption" style={{ textAlign: "center" }}>Add links to see them here.</Text> : null}
          </View>
        </Card>
      </View>
    </>
  );
}

export default function LinkInBio() {
  // An editing form: don't refetch underneath unsaved edits.
  const query = useApiQuery<LinkPageResponse>(PATH, undefined, { staleTime: Infinity, refetchOnWindowFocus: false });
  return (
    <Screen>
      <Stack.Screen options={{ title: "Link-in-Bio" }} />
      <QueryView query={query}>{(d) => <Editor initial={d.page} />}</QueryView>
    </Screen>
  );
}

const s = StyleSheet.create({
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" },
  themeHit: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  themeDot: { width: 24, height: 24, borderRadius: 12 },
  themeOn: { borderWidth: 2, borderColor: colors.white },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  previewLink: { paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, alignItems: "center", paddingHorizontal: 12 },
});
