// Stripe Checkout / Billing Portal from the app: the same POST the web makes
// (/api/billing/checkout or /api/billing/portal) returns a Stripe URL, which
// opens in the in-app browser. When the artist comes back, the plan is re-read
// (billing + /api/mobile/me) so the new plan shows without a manual refresh.
//
// iOS resolves openBrowserAsync when the sheet closes; Android resolves as soon
// as the Custom Tab opens, so we also refetch when the app returns to the
// foreground.

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { post } from "@/api/client";
import { errorMessage } from "@/api/errors";
import { useAuth } from "@/auth/AuthProvider";
import { useToast } from "@/components/ui";
import { useInvalidate } from "@/hooks/useApi";
import { openInBrowser } from "@/lib/links";

export function useStripeRedirect() {
  const toast = useToast();
  const invalidate = useInvalidate();
  const { refreshUser } = useAuth();
  const [pending, setPending] = useState<string | null>(null);
  const awaitingReturn = useRef(false);

  const sync = useCallback(async () => {
    await Promise.all([invalidate("/api/mobile/billing", "/api/mobile/coach", "/api/mobile/dashboard"), refreshUser()]);
  }, [invalidate, refreshUser]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && awaitingReturn.current) {
        awaitingReturn.current = false;
        void sync();
      }
    });
    return () => sub.remove();
  }, [sync]);

  /** `key` identifies which button is busy (e.g. the plan key or "portal"). */
  const start = useCallback(
    async (key: string, path: "/api/billing/checkout" | "/api/billing/portal", body?: unknown) => {
      if (pending) return;
      setPending(key);
      try {
        const { url } = await post<{ url?: string }>(path, body);
        if (!url) throw new Error("No URL");
        awaitingReturn.current = true;
        await openInBrowser(url);
        await sync();
      } catch (err) {
        toast(
          err instanceof Error && err.message === "No URL"
            ? path.endsWith("portal")
              ? "Could not open billing portal"
              : "Could not start checkout"
            : errorMessage(err),
          "error",
        );
      } finally {
        setPending(null);
      }
    },
    [pending, sync, toast],
  );

  return { start, pending };
}
