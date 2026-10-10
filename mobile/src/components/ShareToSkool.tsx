// Native port of the web's src/components/ShareToSkool.tsx. Like the web, it
// never auto-posts (Skool has no public post API): the button opens a preview of
// the achievement card; "Copy caption & open Skool" copies the caption and opens
// the Skool community so the artist pastes and posts it.

import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";

import type { SharePayload } from "@/types/api";
import { openInBrowser } from "@/lib/links";
import { colors, fonts, gradients, radius } from "@/theme/tokens";
import { Button, Modal, Text } from "./ui";

export function ShareToSkool({
  share,
  label = "Share to Skool",
  size = "md",
  variant = "primary",
}: {
  share: SharePayload;
  label?: string;
  size?: "sm" | "md";
  variant?: "primary" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function copyAndOpen() {
    // Open Skool first (the Skool app when installed, else the in-app browser),
    // then copy the caption. A clipboard failure must not block the open.
    Linking.openURL(share.url).catch(() => openInBrowser(share.url).catch(() => {}));
    Clipboard.setStringAsync(share.caption)
      .then(() => setCopied(true))
      .catch(() => {});
  }

  function close() {
    setOpen(false);
    setCopied(false);
  }

  return (
    <>
      <Button title={`🎉 ${label}`} onPress={() => setOpen(true)} variant={variant} size={size} />

      <Modal visible={open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close">
          <Pressable style={styles.card} onPress={() => {}} accessibilityViewIsModal accessibilityLabel="Share to the community">
            <LinearGradient {...gradients.brand} style={styles.preview}>
              <Text style={styles.emoji}>{share.emoji}</Text>
              <Text style={styles.headline}>{share.headline}</Text>
              <Text style={styles.byline}>on Riff · SoundRig</Text>
            </LinearGradient>

            <Text variant="caption" style={{ marginBottom: 4 }}>Your post</Text>
            <View style={styles.caption}>
              <Text>{share.caption}</Text>
            </View>

            <Button
              title={copied ? "✓ Caption copied — opening Skool…" : "Copy caption & open Skool →"}
              onPress={copyAndOpen}
              fullWidth
            />
            <Text style={styles.hint}>
              We copied your caption. Paste it into the community and hit post to share your win.
            </Text>
            <Button title="Close" variant="ghost" size="sm" fullWidth onPress={close} style={{ marginTop: 8 }} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 16 },
  card: {
    width: "100%",
    maxWidth: 384,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: 24,
  },
  preview: { borderRadius: radius.xl, padding: 24, alignItems: "center", marginBottom: 20 },
  emoji: { fontSize: 48, lineHeight: 56, marginBottom: 8 },
  headline: { fontSize: 18, lineHeight: 22, fontFamily: fonts.bold, color: colors.white, textAlign: "center" },
  byline: { fontSize: 12, lineHeight: 16, color: colors.white, opacity: 0.8, marginTop: 8 },
  caption: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: 12,
    marginBottom: 16,
  },
  hint: { fontSize: 11, lineHeight: 15, color: colors.muted, textAlign: "center", marginTop: 12 },
});
