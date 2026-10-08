// Page scaffolding: safe areas, scroll + pull-to-refresh, keyboard avoidance,
// and the web's PageHeader (24 bold title, 14 muted subtitle).

import { useCallback, useState } from "react";
import { RefreshControl, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/theme/tokens";
import { Text } from "./Text";

export function Screen({
  children,
  onRefresh,
  scroll = true,
  contentStyle,
  edges = "bottom",
}: {
  children: React.ReactNode;
  /** Enables pull-to-refresh. Should return the refetch promise. */
  onRefresh?: () => Promise<unknown>;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Screens under a native header only need the bottom inset. */
  edges?: "bottom" | "all" | "none";
}) {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const pad = {
    paddingTop: edges === "all" ? insets.top + 16 : 16,
    paddingBottom: (edges === "none" ? 0 : insets.bottom) + 24,
  };

  if (!scroll) return <View style={[styles.root, pad, contentStyle]}>{children}</View>;

  return (
    <KeyboardAwareScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, pad, contentStyle]}
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brand} colors={[colors.brand]} progressBackgroundColor={colors.surface} />
        ) : undefined
      }
    >
      {children}
    </KeyboardAwareScrollView>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="title" accessibilityRole="header">{title}</Text>
        {subtitle ? <Text variant="small" style={{ marginTop: 4 }}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Section({ title, right, children }: { title?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      {title ? (
        <View style={styles.sectionHead}>
          <Text variant="label" accessibilityRole="header">{title}</Text>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, gap: 16 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 8 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
