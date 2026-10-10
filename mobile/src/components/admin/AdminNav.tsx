// The admin shell's navigation — a native port of the web's
// src/components/AdminNav.tsx as it renders below `lg` (i.e. on a phone): a top
// bar with the "Riff admin" wordmark and a menu button that drops down the nav
// items (icon + label, active one highlighted) and the footer ("‹ Artist view",
// avatar / name / role, Log out).

import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router, usePathname, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/auth/AuthProvider";
import { Avatar, Button, Icon, Modal, Text, Wordmark } from "@/components/ui";
import { colors, fonts, radius } from "@/theme/tokens";
import { ADMIN_NAV, isNavActive } from "./access";

/** Header title: the wordmark with the "admin" suffix. */
export function AdminWordmark() {
  return <Wordmark size={24} suffix="admin" />;
}

/** Header right: the menu button and its drop-down drawer. */
export function AdminMenuButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Open menu"
        accessibilityState={{ expanded: open }}
        hitSlop={8}
        style={({ pressed }) => [styles.menuBtn, pressed && { backgroundColor: colors.surface2 }]}
      >
        <Icon name="menu" size={24} strokeWidth={2} color={colors.foreground} />
      </Pressable>
      <AdminMenu open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function AdminMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const displayName = user?.profile?.stageName ?? user?.user.email.split("@")[0] ?? "";
  const role = user?.user.role ?? "admin";

  function go(href: string) {
    onClose();
    if (pathname === href) return;
    if (href === "/admin") router.dismissTo("/admin" as Href);
    // From the overview, push so back returns to it; elsewhere swap the screen
    // so hopping between sections doesn't pile up a deep stack.
    else if (pathname === "/admin") router.push(href as Href);
    else router.replace(href as Href);
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.sheet, { paddingTop: insets.top }]}>
        <View style={styles.bar}>
          <AdminWordmark />
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
            hitSlop={8}
            style={({ pressed }) => [styles.menuBtn, pressed && { backgroundColor: colors.surface2 }]}
          >
            <Icon name="close" size={24} strokeWidth={2} color={colors.foreground} />
          </Pressable>
        </View>
        <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={styles.list} bounces={false}>
          {ADMIN_NAV.map((n) => {
            const active = isNavActive(pathname, n.href);
            return (
              <Pressable
                key={n.href}
                onPress={() => go(n.href)}
                accessibilityRole="link"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [styles.item, (active || pressed) && { backgroundColor: colors.surface2 }]}
              >
                <Icon name={n.icon} size={17} color={active ? colors.foreground : colors.muted} />
                <Text style={[styles.itemText, active && styles.itemTextActive]}>{n.label}</Text>
              </Pressable>
            );
          })}

          <View style={styles.footer}>
            <Pressable
              onPress={() => {
                onClose();
                router.dismissTo("/");
              }}
              accessibilityRole="link"
              style={({ pressed }) => [styles.item, { gap: 8 }, pressed && { backgroundColor: colors.surface2 }]}
            >
              <Icon name="chevronLeft" size={16} color={colors.muted} />
              <Text style={styles.itemText}>Artist view</Text>
            </Pressable>
            <View style={styles.who}>
              <Avatar name={displayName || "?"} size={32} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text weight="semibold" numberOfLines={1}>{displayName}</Text>
                <Text variant="caption" numberOfLines={1} style={{ textTransform: "capitalize" }}>{role}</Text>
              </View>
            </View>
            <View style={{ paddingHorizontal: 4, paddingTop: 8 }}>
              <Button
                title="Log out"
                variant="ghost"
                size="sm"
                loading={loggingOut}
                onPress={async () => {
                  setLoggingOut(true);
                  try {
                    await logout();
                  } finally {
                    setLoggingOut(false);
                    onClose();
                  }
                }}
              />
            </View>
          </View>
        </ScrollView>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close menu" />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  menuBtn: { padding: 8, marginRight: 8, borderRadius: radius.md },
  sheet: { flex: 1, backgroundColor: "transparent" },
  bar: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  list: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  item: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, minHeight: 44, borderRadius: radius.md },
  itemText: { fontSize: 14, lineHeight: 20, fontFamily: fonts.regular, color: colors.muted },
  itemTextActive: { fontFamily: fonts.semibold, color: colors.foreground },
  footer: { paddingTop: 12, marginTop: 2, borderTopWidth: 1, borderTopColor: colors.border },
  who: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8, paddingVertical: 6, marginTop: 4 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
});
