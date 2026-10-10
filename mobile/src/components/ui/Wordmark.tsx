import { View } from "react-native";

import { colors, fonts } from "@/theme/tokens";
import { Text } from "./Text";

/** The "Riff" wordmark: Pirata One in brand violet, as on the web. */
export function Wordmark({ size = 24, suffix }: { size?: number; suffix?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }} accessibilityRole="header" accessibilityLabel={suffix ? `Riff ${suffix}` : "Riff"}>
      <Text style={{ fontFamily: fonts.display, fontSize: size, lineHeight: size * 1.2, color: colors.brand, letterSpacing: size * 0.025 }}>Riff</Text>
      {suffix ? <Text variant="caption">{suffix}</Text> : null}
    </View>
  );
}
