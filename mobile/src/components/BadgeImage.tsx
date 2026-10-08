import { Image } from "expo-image";
import { View } from "react-native";

import { absoluteUrl } from "@/config/env";
import { colors, radius } from "@/theme/tokens";
import { Text } from "./ui";

/** A badge tile: the web's /badges/*.svg art (served by the backend) + name. */
export function BadgeImage({ image, name, dim, size = 28 }: { image: string; name: string; dim?: boolean; size?: number }) {
  return (
    <View
      accessibilityLabel={`${name}${dim ? " (locked)" : ""}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        opacity: dim ? 0.4 : 1,
      }}
    >
      <Image source={{ uri: absoluteUrl(image) }} style={{ width: size, height: size }} contentFit="contain" cachePolicy="memory-disk" />
      <Text variant="caption" color={colors.foreground} numberOfLines={1}>{name}</Text>
    </View>
  );
}
