import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/theme/tokens";
import { Icon } from "./ui/Icon";
import { Text } from "./ui/Text";

/** Thin banner while the device has no connection. Cached screens stay usable. */
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);
  useEffect(() => NetInfo.addEventListener((s) => setOffline(s.isConnected === false)), []);
  if (!offline) return null;
  return (
    <View pointerEvents="none" style={[styles.bar, { top: insets.top }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Icon name="globe" size={14} color={colors.warning} />
      <Text variant="caption" color={colors.foreground}>You&apos;re offline. Showing the last loaded data.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
    backgroundColor: colors.surface2,
    borderBottomWidth: 1,
    borderBottomColor: colors.warning + "66",
  },
});
