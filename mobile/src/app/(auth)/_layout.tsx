import { Stack } from "expo-router";

import { colors } from "@/theme/tokens";

// Signed-out users land on login (signup is one tap away).
export const unstable_settings = { initialRouteName: "login" };

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: "fade" }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}
