// Session state for the whole app.
//
// Auth is the website's own system: the same /api/auth/login and /api/auth/signup
// routes, the same User rows, the same 30-day JWT. The only native difference is
// transport: the app keeps the JWT in the OS keystore (expo-secure-store) and
// sends it as a Bearer header instead of relying on a browser cookie.
//
// On launch the stored token is validated against GET /api/mobile/me, so a
// revoked/expired token or a deleted account lands on the login screen instead of
// a broken app. Role comes from the server, never from local state, and the
// backend re-checks it on every admin request.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { deleteToken, getToken, setToken } from "./tokenStore";
import { useQueryClient } from "@tanstack/react-query";

import { api, setAuthToken, setUnauthorizedHandler } from "@/api/client";
import { ApiError } from "@/api/errors";
import type { MeResponse } from "@/types/api";

const TOKEN_KEY = "riff_session";

type LoginResult = { status: "ok" } | { status: "mfa_required" };

type AuthState = {
  /** "loading" only while restoring a stored session at startup. */
  status: "loading" | "signedOut" | "signedIn";
  user: MeResponse | null;
  isStaff: boolean;
  login: (email: string, password: string, code?: string) => Promise<LoginResult>;
  signup: (input: { email: string; password: string; stageName?: string }) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-read /api/mobile/me (after profile/plan/role changes). */
  refreshUser: () => Promise<void>;
  /** Set when the session ended on its own (expired / revoked), for the login screen. */
  sessionExpired: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

type AuthResponse = { id: string; email: string; role?: string; token?: string; mfaRequired?: boolean };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [user, setUser] = useState<MeResponse | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const signingOut = useRef(false);

  const clearLocal = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    setStatus("signedOut");
    queryClient.clear(); // never show one account's cached data to the next
    try {
      await deleteToken(TOKEN_KEY);
    } catch {
      // keystore unavailable: the in-memory token is already gone
    }
  }, [queryClient]);

  const loadMe = useCallback(async () => {
    const me = await api<MeResponse>("/api/mobile/me");
    setUser(me);
    setStatus("signedIn");
  }, []);

  const startSession = useCallback(
    async (token: string) => {
      setAuthToken(token);
      try {
        await setToken(TOKEN_KEY, token);
      } catch {
        // Keystore unavailable: the session still works for this launch, the
        // artist just has to log in again next time.
      }
      setSessionExpired(false);
      await loadMe();
    },
    [loadMe],
  );

  // Restore a stored session on launch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let token: string | null = null;
      try {
        token = await getToken(TOKEN_KEY);
      } catch {
        token = null;
      }
      if (!token) {
        if (!cancelled) setStatus("signedOut");
        return;
      }
      setAuthToken(token);
      try {
        await loadMe();
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && (err.kind === "unauthorized" || err.kind === "not_found")) {
          setSessionExpired(true);
          await clearLocal();
        } else {
          // Offline or server down: keep the session and let screens show their
          // own offline/retry states rather than logging the artist out.
          setStatus("signedIn");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMe, clearLocal]);

  // Any authenticated request that comes back 401 means the session is gone.
  useEffect(() => {
    // Some routes also use 401 for a wrong password / MFA code, so confirm the
    // session itself is gone before signing the artist out.
    let checking = false;
    setUnauthorizedHandler(() => {
      if (signingOut.current || checking) return;
      checking = true;
      api<MeResponse>("/api/mobile/me", { skipAuthRedirect: true })
        .then(setUser)
        .catch((err) => {
          if (err instanceof ApiError && (err.kind === "unauthorized" || err.kind === "not_found")) {
            setSessionExpired(true);
            void clearLocal();
          }
        })
        .finally(() => {
          checking = false;
        });
    });
    return () => setUnauthorizedHandler(null);
  }, [clearLocal]);

  const login = useCallback<AuthState["login"]>(
    async (email, password, code) => {
      const res = await api<AuthResponse>("/api/auth/login", {
        method: "POST",
        body: { email: email.trim(), password, ...(code ? { code: code.replace(/\s/g, "") } : {}) },
        skipAuthRedirect: true,
      });
      if (res.mfaRequired) return { status: "mfa_required" };
      if (!res.token) throw new ApiError("server", "The server did not return a session.");
      await startSession(res.token);
      return { status: "ok" };
    },
    [startSession],
  );

  const signup = useCallback<AuthState["signup"]>(
    async ({ email, password, stageName }) => {
      const res = await api<AuthResponse>("/api/auth/signup", {
        method: "POST",
        body: { email: email.trim(), password, ...(stageName?.trim() ? { stageName: stageName.trim() } : {}) },
        skipAuthRedirect: true,
      });
      if (!res.token) throw new ApiError("server", "The server did not return a session.");
      await startSession(res.token);
    },
    [startSession],
  );

  const logout = useCallback(async () => {
    signingOut.current = true;
    try {
      // Clears the server-side cookie path too; harmless for bearer clients.
      await api("/api/auth/logout", { method: "POST", body: {}, skipAuthRedirect: true, timeoutMs: 5000 });
    } catch {
      // Logging out must work offline.
    } finally {
      await clearLocal();
      setSessionExpired(false);
      signingOut.current = false;
    }
  }, [clearLocal]);

  const refreshUser = useCallback(async () => {
    try {
      await loadMe();
    } catch {
      // keep the last known user; the 401 handler covers expiry
    }
  }, [loadMe]);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      isStaff: !!user?.user.isStaff,
      login,
      signup,
      logout,
      refreshUser,
      sessionExpired,
    }),
    [status, user, login, signup, logout, refreshUser, sessionExpired],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Called after account deletion: the server already removed the user. */
export async function forgetStoredSession() {
  setAuthToken(null);
  try {
    await deleteToken(TOKEN_KEY);
  } catch {
    // ignore
  }
}
