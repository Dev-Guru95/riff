// Write helpers for the admin screens.
//
// useAdminAction: runs a request through useApiMutation (which toasts failures —
// including the server's 403 "Forbidden — admin access required" — and
// invalidates the given API paths), toasts an optional success message, and
// resolves to the response or `undefined` on failure so callers never try/catch.
//
// useAdminCall: the same request + invalidation, but no toasts. It resolves to
// `{ data }` or `{ error, body }` so a screen can show the server's message
// inline, where the web admin shows it (form errors, "Saved", reward results).

import { useCallback, useRef, useState } from "react";

import { api, type RequestOptions } from "@/api/client";
import { ApiError, errorMessage } from "@/api/errors";
import { useToast } from "@/components/ui";
import { useApiMutation, useInvalidate } from "@/hooks/useApi";

type Method = NonNullable<RequestOptions["method"]>;

export function useAdminAction(invalidates: string[]) {
  const toast = useToast();
  const { mutateAsync, isPending } = useApiMutation<unknown>({ invalidates });

  const run = useCallback(
    async <T = unknown>(path: string, method: Method, body?: unknown, success?: string): Promise<T | undefined> => {
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

/** `error` is "" when the call was ignored because one is already in flight. */
export type CallResult<T> = { ok: true; data: T } | { ok: false; error: string; body?: Record<string, unknown> };

export function useAdminCall(invalidates: string[]) {
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState(false);
  // A ref, not state, so a double tap in the same frame can't send twice.
  const inFlight = useRef(false);
  const paths = invalidates.join("|");

  const call = useCallback(
    async <T = unknown>(path: string, method: Method, body?: unknown, opts?: { skipAuthRedirect?: boolean }): Promise<CallResult<T>> => {
      if (inFlight.current) return { ok: false, error: "" };
      inFlight.current = true;
      setBusy(true);
      try {
        const data = await api<T>(path, { method, body: body ?? (method === "DELETE" ? undefined : {}), skipAuthRedirect: opts?.skipAuthRedirect });
        if (paths) await invalidate(...paths.split("|"));
        return { ok: true, data };
      } catch (err) {
        return { ok: false, error: errorMessage(err), body: err instanceof ApiError ? err.body : undefined };
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [invalidate, paths],
  );

  return { call, busy };
}

/**
 * The web's fieldErrorMessage(): turn a zod 422 `{ issues: { fieldErrors } }`
 * into one readable "Field message" line, or null when there is none.
 */
export function fieldErrorMessage(body: Record<string, unknown> | undefined): string | null {
  const fe = (body as { issues?: { fieldErrors?: Record<string, string[]> } } | undefined)?.issues?.fieldErrors;
  if (!fe) return null;
  const parts = Object.entries(fe).map(([field, msgs]) => {
    const nice = field.charAt(0).toUpperCase() + field.slice(1);
    const msg = (msgs?.[0] ?? "is invalid").replace(/Too small: expected string to have >=(\d+) characters/, "must be at least $1 characters");
    return `${nice} ${msg}`;
  });
  return parts.length ? parts.join("; ") : null;
}
