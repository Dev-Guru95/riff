// Primary navigation. The web's 13-item sidebar becomes five bottom tabs for the
// most-used sections; the rest live under "More" in the web's nav order.

import { Pressable, StyleSheet, View, type ColorValue } from "react-native";
import { router } from "expo-router";
import { Tabs } from "expo-router/js-tabs";

import { Icon, Text, type IconName } from "@/components/ui";
import { useNotifications } from "@/hooks/useNotifications";
import { colors, fonts } from "@/theme/tokens";

function tabIcon(name: IconName) {
  return function TabIcon({ color }: { color: ColorValue }) {
    return <Icon name={name} size={22} color={String(color)} />;
  };
}

function BellButton() {
  const { data } = useNotifications();
  const unread = data?.unread ?? 0;
  return (
    <Pressable
      onPress={() => router.push("/notifications")}
      accessibilityRole="button"
      accessibilityLabel={unread ? `Notifications, ${unread} unread` : "Notifications"}
      hitSlop={10}
      style={styles.bell}
    >
      <Icon name="bell" size={22} color={colors.foreground} />
      {unread > 0 ? (
        <View style={styles.dot}>
          <Text style={styles.dotText}>{unread > 9 ? "9+" : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 17 },
        headerShadowVisible: false,
        headerRight: () => <BellButton />,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: tabIcon("home") }} />
      <Tabs.Screen name="courses" options={{ title: "Courses", tabBarIcon: tabIcon("book") }} />
      <Tabs.Screen name="coach" options={{ title: "Coach", tabBarIcon: tabIcon("chat") }} />
      <Tabs.Screen name="boards" options={{ title: "Projects", tabBarIcon: tabIcon("kanban") }} />
      <Tabs.Screen name="more" options={{ title: "More", tabBarIcon: tabIcon("menu") }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bell: { marginRight: 16, width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  dot: {
    position: "absolute",
    top: 0,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.brand2,
    alignItems: "center",
    justifyContent: "center",
  },
  dotText: { color: colors.white, fontSize: 10, lineHeight: 12, fontFamily: fonts.bold },
});
