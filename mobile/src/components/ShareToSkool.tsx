// Native "Share to Skool": like the web, it never auto-posts. It copies the
// prefilled caption, then opens the Skool community so the artist pastes it.
// The system share sheet is offered too, which is the mobile-native path.

import { Alert, Share } from "react-native";
import * as Clipboard from "expo-clipboard";

import type { SharePayload } from "@/types/api";
import { openInBrowser } from "@/lib/links";
import { Button } from "./ui";

export function ShareToSkool({ share, label = "Share to Skool", size = "sm" }: { share: SharePayload; label?: string; size?: "sm" | "md" }) {
  async function onPress() {
    const text = `${share.emoji} ${share.headline}\n\n${share.caption}`;
    Alert.alert(label, "Copy your post, then paste it in the Skool community.", [
      { text: "Cancel", style: "cancel" },
      { text: "Share…", onPress: () => void Share.share({ message: text }) },
      {
        text: "Copy & open Skool",
        onPress: async () => {
          await Clipboard.setStringAsync(text);
          await openInBrowser(share.url);
        },
      },
    ]);
  }
  return <Button title={label} onPress={onPress} variant="ghost" size={size} icon="sparkles" />;
}
