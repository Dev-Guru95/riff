// React Query setup: caching, retry policy and mobile lifecycle wiring.
// Server data is never persisted to device storage — the backend stays the
// single source of truth; the cache only lives for the app session.

import { AppState, Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { QueryClient, focusManager, onlineManager } from "@tanstack/react-query";

import { ApiError } from "./errors";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      // Retry only transient failures; a 401/403/404/422 won't fix itself.
      retry: (count, err) => {
        if (err instanceof ApiError && !["network", "timeout", "server"].includes(err.kind)) return false;
        return count < 2;
      },
      retryDelay: (n) => Math.min(1000 * 2 ** n, 8000),
    },
    mutations: { retry: false },
  },
});

// Pause queries while offline and refetch when the connection returns.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
);

// Refetch stale data when the app comes back to the foreground.
export function wireAppFocus() {
  const sub = AppState.addEventListener("change", (status) => {
    if (Platform.OS !== "web") focusManager.setFocused(status === "active");
  });
  return () => sub.remove();
}
