import { Pressable, View } from "react-native";

import { colors, fonts } from "@/theme/tokens";
import { Text } from "./Text";

/**
 * The "Riff" wordmark: Pirata One in brand violet, as on the web.
 *
 * Pass `onPress` to make it a shortcut back to Home, which is what the web
 * wordmark does — it is a link to /dashboard there. Without `onPress` it stays
 * a plain header mark, so the admin header is unaffected.
 */
export function Wordmark({
  size = 24,
  suffix,
  onPress,
}: {
  size?: number;
  suffix?: string;
  onPress?: () => void;
}) {
  const label = suffix ? `Riff ${suffix}` : "Riff";

  const mark = (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: size,
          lineHeight: size * 1.2,
          color: colors.brand,
          letterSpacing: size * 0.025,
        }}
      >
        Riff
      </Text>
      {suffix ? <Text variant="caption">{suffix}</Text> : null}
    </View>
  );

  if (!onPress) {
    return (
      <View accessibilityRole="header" accessibilityLabel={label}>
        {mark}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${label}, go to Home`}
      // The mark is short and sits at the screen edge, so widen the touch
      // target rather than the mark itself.
      hitSlop={12}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {mark}
    </Pressable>
  );
}
