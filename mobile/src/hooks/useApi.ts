// Thin react-query wrappers so screens declare *what* they need, not how to
// fetch it. Query keys are the API path (+ params), which keeps invalidation
// simple: `invalidate("/api/mobile/dashboard")` after a mutation that changes it.

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";

import { api, get, type RequestOptions } from "@/api/client";
import { errorMessage } from "@/api/errors";
import { useToast } from "@/components/ui/Toast";

type Query = RequestOptions["query"];

export function useApiQuery<T>(
  path: string | null,
  query?: Query,
  options?: Omit<UseQueryOptions<T>, "queryKey" | "queryFn">,
) {
  return useQuery<T>({
    queryKey: query ? [path, query] : [path],
    queryFn: () => get<T>(path!, query),
    enabled: !!path && (options?.enabled ?? true),
    ...options,
  });
}

/** Invalidate one or more API paths (prefix match on the first key segment). */
export function useInvalidate() {
  const qc = useQueryClient();
  return useCallback(
    (...paths: string[]) =>
      Promise.all(paths.map((p) => qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith(p) }))),
    [qc],
  );
}

type MutationArgs = { path: string; method?: RequestOptions["method"]; body?: unknown };

/**
 * A mutation that toasts errors (and optionally success) and invalidates the
 * given paths afterwards, so every list reflects the server state.
 */
export function useApiMutation<T = unknown>({
  invalidates = [],
  success,
  onSuccess,
}: {
  invalidates?: string[];
  success?: string;
  onSuccess?: (data: T) => void;
} = {}) {
  const toast = useToast();
  const invalidate = useInvalidate();
  return useMutation<T, unknown, MutationArgs>({
    mutationFn: ({ path, method = "POST", body }) => api<T>(path, { method, body: body ?? (method === "DELETE" ? undefined : {}) }),
    onSuccess: async (data) => {
      if (invalidates.length) await invalidate(...invalidates);
      if (success) toast(success);
      onSuccess?.(data);
    },
    onError: (err) => toast(errorMessage(err), "error"),
  });
}
