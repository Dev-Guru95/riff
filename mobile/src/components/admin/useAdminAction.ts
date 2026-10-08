// One write helper for the admin screens: runs a request through
// useApiMutation (which toasts failures — including the server's 403
// "Forbidden — admin access required" — and invalidates the given API paths),
// toasts a success message, and resolves to the response or `undefined` on
// failure so callers never have to try/catch.

import { useCallback } from "react";

import type { RequestOptions } from "@/api/client";
import { useToast } from "@/components/ui";
import { useApiMutation } from "@/hooks/useApi";

export function useAdminAction(invalidates: string[]) {
  const toast = useToast();
  const { mutateAsync, isPending } = useApiMutation<unknown>({ invalidates });

  const run = useCallback(
    async <T = unknown>(
      path: string,
      method: NonNullable<RequestOptions["method"]>,
      body?: unknown,
      success?: string,
    ): Promise<T | undefined> => {
      try {
        const res = (await mutateAsync({ path, method, body })) as T;
        if (success) toast(success);
        return res;
      } catch {
        return undefined; // already toasted by useApiMutation
      }
    },
    [mutateAsync, toast],
  );

  return { run, busy: isPending };
}
