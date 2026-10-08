// Signed-in area. Tabs hold the primary sections; everything else (course
// detail, lessons, boards, studio tools, settings, admin) pushes onto this stack
// with a native header and back gesture.

import { Stack } from "expo-router";

import { useAuth } from "@/auth/AuthProvider";
import { colors, fonts } from "@/theme/tokens";

export default function AppLayout() {
  const { isStaff } = useAuth();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 16 },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {/* Admin screens exist only for staff. The server enforces the same rule on
          every admin request; this guard just keeps the UI honest. */}
      <Stack.Protected guard={isStaff}>
        <Stack.Screen name="admin" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
