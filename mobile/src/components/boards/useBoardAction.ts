// One write helper for the Kanban screens. Like useApiMutation (invalidate the
// affected API paths, toast the result) but callable with a different path per
// call, awaitable, and able to report errors with an Alert when the caller is
// inside a native modal sheet (where the app-level toast would be hidden
// behind the sheet).

import { useCallback, useState } from "react";
import { Alert } from "react-native";

import { api, type RequestOptions } from "@/api/client";
import { errorMessage } from "@/api/errors";
import { useToast } from "@/components/ui";
import { useInvalidate } from "@/hooks/useApi";

type RunOptions = {
  method?: RequestOptions["method"];
  body?: unknown;
  /** API paths to refetch afterwards (prefix match). */
  invalidates?: string[];
  /** Toast shown on success. */
  success?: string;
  /** Show failures with Alert.alert instead of a toast (use inside <Sheet>). */
  alertErrors?: boolean;
};

export function useBoardAction() {
  const toast = useToast();
  const invalidate = useInvalidate();
  const [pending, setPending] = useState(0);

  const run = useCallback(
    async <T = unknown>(path: string, opts: RunOptions = {}): Promise<T | undefined> => {
      const method = opts.method ?? "POST";
      setPending((n) => n + 1);
      try {
        const data = await api<T>(path, { method, body: opts.body ?? (method === "DELETE" ? undefined : {}) });
        if (opts.invalidates?.length) await invalidate(...opts.invalidates);
        if (opts.success) toast(opts.success);
        return data;
      } catch (err) {
        if (opts.alertErrors) Alert.alert("Couldn't do that", errorMessage(err));
        else toast(errorMessage(err), "error");
        return undefined;
      } finally {
        setPending((n) => n - 1);
      }
    },
    [invalidate, toast],
  );

  return { run, busy: pending > 0 };
}
