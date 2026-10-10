// Admin area stack. The parent (app) stack renders this route only for staff
// (<Stack.Protected guard={isStaff}>) and hides its own header, so this stack
// draws the admin shell's top bar: the web's AdminNav at phone width — the
// "Riff admin" wordmark and a menu button that opens the section nav and the
// account footer (src/components/admin/AdminNav.tsx). The server still enforces
// every role.

import { Stack } from "expo-router";

import { AdminMenuButton, AdminWordmark } from "@/components/admin/AdminNav";
import { colors, fonts } from "@/theme/tokens";

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 16 },
        headerTitleAlign: "left",
        headerTitle: () => <AdminWordmark />,
        headerRight: () => <AdminMenuButton />,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
