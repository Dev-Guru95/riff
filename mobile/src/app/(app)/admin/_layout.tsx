// Admin area stack. The parent (app) stack renders this route only for staff
// (<Stack.Protected guard={isStaff}>) and hides its own header, so this stack
// draws the header with the same styling. The server still enforces every role.

import { Stack } from "expo-router";

import { colors, fonts } from "@/theme/tokens";

export default function AdminLayout() {
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
    />
  );
}
