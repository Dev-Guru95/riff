// The web's UserNav drawer (src/components/UserNav.tsx) minus the four links
// that are bottom tabs (Home, Courses, Coach, Projects): the remaining links in
// the web's order, Admin for staff, then the account footer (avatar, name,
// plan, Log out).

import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, type Href } from "expo-router";

import { useAuth } from "@/auth/AuthProvider";
import { Avatar, Button, Icon, Screen, Text, type IconName } from "@/components/ui";
import { colors, radius, TOUCH } from "@/theme/tokens";

type NavItem = { href: string; label: string; icon: IconName };

const LINKS: NavItem[] = [
  { href: "/missions", label: "Missions", icon: "target" },
  { href: "/studio", label: "Studio", icon: "disc" },
  { href: "/audit", label: "Audit", icon: "layers" },
  { href: "/roadmap", label: "Roadmap", icon: "route" },
  { href: "/community", label: "Community", icon: "community" },
  { href: "/leaderboard", label: "Ranks", icon: "trophy" },
  { href: "/pricing", label: "Plans", icon: "card" },
  // Account deletion must be discoverable from inside the app (Play policy).
  { href: "/settings", label: "Settings", icon: "settings" },
];

function NavLink({ item }: { item: NavItem }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push(item.href as Href)}
      style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
    >
      {({ pressed }) => (
        <>
          <Icon name={item.icon} size={17} color={pressed ? colors.foreground : colors.muted} />
          <Text variant="small" color={pressed ? colors.foreground : colors.muted}>{item.label}</Text>
        </>
      )}
    </Pressable>
  );
}

export default function More() {
  const { user, isStaff, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const email = user?.user.email;
  const displayName = user?.profile?.stageName ?? email?.split("@")[0] ?? "artist";
  const links = isStaff ? [...LINKS, { href: "/admin", label: "Admin", icon: "shield" as const }] : LINKS;

  return (
    <Screen contentStyle={{ gap: 2, paddingHorizontal: 12 }}>
      {links.map((item) => (
        <NavLink key={item.href} item={item} />
      ))}

      <View style={styles.footer}>
        <View style={styles.account}>
          <Avatar name={displayName} size={32} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text weight="semibold" numberOfLines={1}>{displayName}</Text>
            <Text variant="caption" numberOfLines={1} style={{ textTransform: "capitalize" }}>{user?.plan ?? "free"}</Text>
          </View>
        </View>
        <View style={{ paddingHorizontal: 4, paddingTop: 8 }}>
          <Button
            title="Log out"
            variant="ghost"
            size="sm"
            loading={loggingOut}
            onPress={() => {
              setLoggingOut(true);
              void logout();
            }}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: TOUCH,
    borderRadius: radius.md,
  },
  linkPressed: { backgroundColor: colors.surface2 },
  footer: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  account: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8, paddingVertical: 6 },
});
