// Link-in-Bio — the web's /studio/link-in-bio (LinkInBioClient.tsx).
// Data: GET/PATCH /api/studio/link-page. The public page (/u/[handle]) is a web
// page with no native screen, so "View live" opens it in the in-app browser.

import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Stack } from "expo-router";

import { errorMessage } from "@/api/errors";
import { IconButton } from "@/components/studio/shared";
import { Button, Card, Field, PageHeader, QueryView, Screen, Text, useToast } from "@/components/ui";
import { absoluteUrl } from "@/config/env";
import { useApiMutation, useApiQuery } from "@/hooks/useApi";
import { openInBrowser } from "@/lib/links";
import { colors, fonts, radius, TOUCH } from "@/theme/tokens";
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
  const toast = useToast();
  const [p, setP] = useState<LinkPageDTO>(initial);
  const save = useApiMutation<LinkPageResponse>({ invalidates: [PATH] });
  const themeColor = THEME_COLOR[p.theme] ?? colors.brand;

  function set<K extends keyof LinkPageDTO>(k: K, v: LinkPageDTO[K]) {
    setP((prev) => ({ ...prev, [k]: v }));
  }
  function setLink(i: number, item: LinkItem) {
    setP((prev) => ({ ...prev, links: prev.links.map((l, j) => (j === i ? item : l)) }));
  }

  // Always send the full current payload so unsaved edits aren't clobbered by
  // the server echoing the last-saved page (same as the web).
  function persist(published?: boolean) {
    save.mutate(
      {
        path: PATH,
        method: "PATCH",
        body: { handle: p.handle, title: p.title, bio: p.bio, theme: p.theme, links: p.links, ...(published === undefined ? {} : { published }) },
      },
      {
        onSuccess: ({ page }) => {
          setP(page);
          toast(published === undefined ? "Saved ✓" : page.published ? "Published" : "Unpublished");
        },
      },
    );
  }

  return (
    <>
      <PageHeader title="🔗 Link-in-Bio" subtitle="Your public landing page for every link." />
      {p.published ? (
        <Button
          title={`View live → /u/${p.handle}`}
          variant="link"
          icon="globe"
          onPress={() => void openInBrowser(absoluteUrl(`/u/${encodeURIComponent(p.handle)}`))}
          style={{ marginTop: -8 }}
        />
      ) : (
        <Text variant="small" color={colors.warning}>Not published yet.</Text>
      )}

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button title={save.isPending ? "Saving…" : "Save"} variant="ghost" style={{ flex: 1 }} loading={save.isPending} onPress={() => persist()} />
        <Button
          title={p.published ? "Unpublish" : "Publish"}
          variant={p.published ? "ghost" : "primary"}
          style={{ flex: 1 }}
          disabled={save.isPending}
          onPress={() => persist(!p.published)}
        />
      </View>
      {save.error ? <Text color={colors.danger} accessibilityLiveRegion="polite">{errorMessage(save.error)}</Text> : null}

      <Card style={{ gap: 14 }}>
        <View style={{ gap: 6 }}>
          <Text variant="caption" weight="medium" color={colors.foreground}>Handle</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text variant="small">/u/</Text>
            <View style={{ flex: 1 }}>
              <Field
                value={p.handle}
                onChangeText={(t) => set("handle", t)}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={30}
                accessibilityLabel="Handle"
              />
            </View>
          </View>
        </View>
        <Field label="Title" value={p.title} onChangeText={(t) => set("title", t)} maxLength={80} />
        <Field label="Bio" value={p.bio} onChangeText={(t) => set("bio", t)} multiline maxLength={500} style={{ minHeight: 72 }} />
        <View style={{ gap: 6 }}>
          <Text variant="caption" weight="medium" color={colors.foreground}>Theme</Text>
          <View style={{ flexDirection: "row", gap: 4 }}>
            {LINK_THEMES.map((t) => {
              const on = p.theme === t;
              return (
                <Pressable
                  key={t}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`Theme ${t}`}
                  onPress={() => set("theme", t)}
                  style={s.themeHit}
                >
                  <View style={[s.themeDot, { backgroundColor: THEME_COLOR[t] }, on && s.themeOn]} />
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text variant="caption" weight="medium" color={colors.foreground}>Links</Text>
            <Button
              title="+ Link"
              size="sm"
              variant="ghost"
              disabled={p.links.length >= 30}
              onPress={() => set("links", [...p.links, { label: "", url: "https://" }])}
            />
          </View>
          {p.links.map((l, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <Field value={l.label} onChangeText={(t) => setLink(i, { ...l, label: t })} placeholder="Label" maxLength={60} accessibilityLabel="Link label" />
                <Field
                  value={l.url}
                  onChangeText={(t) => setLink(i, { ...l, url: t })}
                  placeholder="https://"
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={500}
                  accessibilityLabel="Link URL"
                />
              </View>
              <IconButton icon="close" label="Remove link" onPress={() => set("links", p.links.filter((_, j) => j !== i))} />
            </View>
          ))}
        </View>
      </Card>

      <Text variant="label">Preview</Text>
      <Card style={{ alignItems: "center", gap: 6, borderTopColor: themeColor, borderTopWidth: 3, padding: 20 }}>
        <View style={[s.avatar, { backgroundColor: themeColor }]}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 24, lineHeight: 30 }} color={colors.white}>
            {(p.title || "A")[0]?.toUpperCase()}
          </Text>
        </View>
        <Text weight="bold" style={{ marginTop: 4 }}>{p.title || "Your name"}</Text>
        <Text variant="caption" style={{ textAlign: "center" }}>{p.bio || "Your bio…"}</Text>
        <View style={{ alignSelf: "stretch", gap: 8, marginTop: 12 }}>
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
  themeHit: { width: TOUCH, height: TOUCH, alignItems: "center", justifyContent: "center" },
  themeDot: { width: 26, height: 26, borderRadius: 13 },
  themeOn: { borderWidth: 2, borderColor: colors.white },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  previewLink: { paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, alignItems: "center", paddingHorizontal: 12 },
});
