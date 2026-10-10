// The web re-renders its Server Component pages on every navigation, so a page
// never shows stale progress. Tab screens stay mounted in the app, so refetch
// their query whenever the screen regains focus (skipping the first focus,
// which the initial fetch already covers).

import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";

/** `refetch` must be stable (react-query's `query.refetch` is). */
export function useRefetchOnFocus(refetch: () => unknown) {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      void refetch();
    }, [refetch]),
  );
}
