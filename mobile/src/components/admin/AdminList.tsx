// FlashList scaffold for the long admin lists (users, review queue, reports):
// the same loading / error / offline states QueryView gives a <Screen>, plus
// pull-to-refresh, a header (filters / search) and keyboard-friendly scrolling.
// <Screen> wraps a ScrollView, which a virtualized list must not be nested in.

import { useState } from "react";
import { RefreshControl, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import type { UseQueryResult } from "@tanstack/react-query";

import { ErrorState, ScreenSkeleton } from "@/components/ui";
import { colors } from "@/theme/tokens";

export function AdminList<T, R>({
  query,
  select,
  keyOf,
  renderItem,
  header,
  footer,
  empty,
  extraData,
}: {
  query: UseQueryResult<R>;
  select: (data: R) => T[];
  keyOf: (item: T) => string;
  renderItem: (item: T) => React.ReactElement;
  header?: React.ReactElement | null;
  footer?: React.ReactElement | null;
  empty?: React.ReactElement;
  extraData?: unknown;
}) {
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  const items = query.data !== undefined ? select(query.data) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlashList
        data={items ?? []}
        keyExtractor={keyOf}
        extraData={extraData}
        renderItem={({ item }) => renderItem(item)}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={
          items === undefined ? (
            query.isError ? (
              <ErrorState error={query.error} onRetry={() => void query.refetch()} />
            ) : (
              <View style={{ marginHorizontal: -16 }}>
                <ScreenSkeleton rows={4} />
              </View>
            )
          ) : (
            empty
          )
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brand} colors={[colors.brand]} progressBackgroundColor={colors.surface} />
        }
      />
    </View>
  );
}
