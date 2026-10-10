import { Image } from "expo-image";
import { View } from "react-native";

import { absoluteUrl } from "@/config/env";
import { colors, radius } from "@/theme/tokens";
import { Text } from "./ui";

/**
 * The web's `Badge` (src/components/ui.tsx): a `.card px-3 py-2` tile with the
 * /badges/*.svg art (served by the backend) and the name; locked badges are
 * `opacity-40 grayscale`.
 */
export function BadgeImage({ image, name, dim, size = 28 }: { image: string; name: string; dim?: boolean; size?: number }) {
  return (
    <View
      accessible
      accessibilityLabel={`${name}${dim ? " (locked)" : ""}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        opacity: dim ? 0.4 : 1,
        filter: dim ? [{ grayscale: 1 }] : undefined,
      }}
    >
      <Image source={{ uri: absoluteUrl(image) }} style={{ width: size, height: size }} contentFit="contain" cachePolicy="memory-disk" />
      <Text variant="caption" weight="medium" color={colors.foreground} numberOfLines={1}>{name}</Text>
    </View>
  );
}
