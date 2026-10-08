// Loading / error / empty / offline states. Every data screen renders through
// <QueryView> so none of them can crash or freeze on a failed request.

import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, StyleSheet, View, type DimensionValue } from "react-native";
import type { UseQueryResult } from "@tanstack/react-query";

import { errorMessage, isOfflineError } from "@/api/errors";
import { colors, radius } from "@/theme/tokens";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";

export function EmptyState({
  title,
  body,
  icon = "cactus",
  action,
}: {
  title: string;
  body?: string;
  icon?: IconName;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={s.center}>
      <Icon name={icon} size={40} strokeWidth={1.25} color={colors.muted} />
      <Text variant="heading" style={s.centerText}>{title}</Text>
      {body ? <Text variant="small" style={s.centerText}>{body}</Text> : null}
      {action ? <Button title={action.label} onPress={action.onPress} variant="ghost" style={{ alignSelf: "center" }} /> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const offline = isOfflineError(error);
  return (
    <View style={s.center} accessibilityLiveRegion="polite">
      <Icon name={offline ? "globe" : "close"} size={40} strokeWidth={1.25} color={offline ? colors.warning : colors.danger} />
      <Text variant="heading" style={s.centerText}>{offline ? "You're offline" : "Couldn't load this"}</Text>
      <Text variant="small" style={s.centerText}>{errorMessage(error)}</Text>
      {onRetry ? <Button title="Try again" onPress={onRetry} variant="ghost" style={{ alignSelf: "center" }} /> : null}
    </View>
  );
}

export function LoadingState({ label }: { label?: string }) {
  return (
    <View style={s.center}>
      <ActivityIndicator color={colors.brand} />
      {label ? <Text variant="small">{label}</Text> : null}
    </View>
  );
}

/** Pulsing placeholder block for skeleton layouts. */
export function Skeleton({ height = 16, width = "100%", style }: { height?: number; width?: DimensionValue; style?: object }) {
  const [opacity] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[{ height, width, borderRadius: radius.field, backgroundColor: colors.surface2, opacity }, style]} />;
}

/** A generic list-ish skeleton used while a screen's first load is in flight. */
export function ScreenSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View style={{ padding: 16, gap: 12 }} accessibilityLabel="Loading">
      <Skeleton height={28} width="60%" />
      <Skeleton height={14} width="40%" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={84} style={{ borderRadius: radius.card }} />
      ))}
    </View>
  );
}

/**
 * Renders loading / error / data for a react-query result. Keeps showing the
 * last good data while a background refetch fails, so a flaky connection
 * doesn't blank the screen.
 */
export function QueryView<T>({
  query,
  children,
  skeleton,
  isEmpty,
  empty,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => React.ReactNode;
  skeleton?: React.ReactNode;
  isEmpty?: (data: T) => boolean;
  empty?: React.ReactNode;
}) {
  if (query.data !== undefined) {
    if (isEmpty?.(query.data) && empty) return <>{empty}</>;
    return <>{children(query.data)}</>;
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return <>{skeleton ?? <ScreenSkeleton />}</>;
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 10, minHeight: 240 },
  centerText: { textAlign: "center", maxWidth: 320 },
});
