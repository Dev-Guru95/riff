// Security — the web's /admin/security (page.tsx + SecurityClient.tsx): two-factor
// auth for the signed-in staff account. Data: GET /api/mobile/admin/security.
// Writes: POST /api/auth/mfa/setup → { secret, otpauth }, /enable { code },
// /disable { code }. Results show inline, as on the web.
//
// A wrong code makes /enable and /disable answer 401 ("Invalid code"), which
// the shared client would otherwise treat as an expired session and sign the
// user out — so these calls pass skipAuthRedirect.

import { useState } from "react";
import { Linking, View } from "react-native";
import { Stack } from "expo-router";
import * as Clipboard from "expo-clipboard";

import { useAuth } from "@/auth/AuthProvider";
import { InlineMsg, MONO } from "@/components/admin/controls";
import { useAdminCall } from "@/components/admin/useAdminAction";
import { Button, Card, Field, QueryView, Screen, Text, useToast } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { colors, radius } from "@/theme/tokens";
import type { AdminSecurityResponse } from "@/types/api";

const PATH = "/api/mobile/admin/security";

type Setup = { secret: string; otpauth: string };
type Msg = { ok: boolean; text: string } | null;

function CodeField({ label, value, onChange, autoFocus }: { label: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <Field
      label={label}
      placeholder="000000"
      value={value}
      onChangeText={(t) => onChange(t.replace(/\D/g, ""))}
      keyboardType="number-pad"
      inputMode="numeric"
      textContentType="oneTimeCode"
      autoComplete="one-time-code"
      maxLength={8}
      autoFocus={autoFocus}
    />
  );
}

function MfaManager({ enabled }: { enabled: boolean }) {
  const toast = useToast();
  const { refreshUser } = useAuth();
  const { call, busy } = useAdminCall([PATH]);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  async function startSetup() {
    setMsg(null);
    const res = await call<Setup>("/api/auth/mfa/setup", "POST", {}, { skipAuthRedirect: true });
    if (res.ok) setSetup(res.data);
    else if (res.error) setMsg({ ok: false, text: res.error || "Failed" });
  }

  async function enable() {
    const res = await call("/api/auth/mfa/enable", "POST", { code }, { skipAuthRedirect: true });
    if (res.ok) {
      setMsg({ ok: true, text: "MFA enabled ✓" });
      setSetup(null);
      setCode("");
      await refreshUser(); // /api/mobile/me carries mfaEnabled too
    } else if (res.error) {
      setMsg({ ok: false, text: res.error || "Invalid code" });
    }
  }

  async function disable() {
    const res = await call("/api/auth/mfa/disable", "POST", { code }, { skipAuthRedirect: true });
    if (res.ok) {
      setMsg({ ok: true, text: "MFA disabled" });
      setCode("");
      await refreshUser();
    } else if (res.error) {
      setMsg({ ok: false, text: res.error || "Invalid code" });
    }
  }

  const message = msg ? <InlineMsg ok={msg.ok}>{msg.text}</InlineMsg> : null;

  if (enabled) {
    return (
      <Card style={{ padding: 20, gap: 12 }}>
        <Text weight="semibold" color={colors.success}>🔐 MFA is enabled</Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <CodeField label="Enter a code to disable" value={code} onChange={setCode} />
          </View>
          <Button title="Disable" variant="ghost" onPress={disable} disabled={busy || !code} />
        </View>
        {message}
      </Card>
    );
  }

  return (
    <Card style={{ padding: 20, gap: 16 }}>
      {!setup ? (
        <Button title={busy ? "…" : "Set up MFA"} onPress={startSetup} disabled={busy} />
      ) : (
        <>
          <View style={{ gap: 4 }}>
            <Text style={{ marginBottom: 4 }}>1. Add this secret to your authenticator app (manual entry):</Text>
            <View style={{ backgroundColor: colors.surface2, borderRadius: radius.md, padding: 12 }}>
              <Text selectable style={{ fontFamily: MONO, color: colors.foreground }}>{setup.secret}</Text>
            </View>
            <Text variant="caption" selectable>Or use the otpauth URI: {setup.otpauth}</Text>
            {/* Phone conveniences: there is no second screen to type from. */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
              <Button
                title="Copy secret"
                variant="ghost"
                size="sm"
                onPress={async () => {
                  await Clipboard.setStringAsync(setup.secret);
                  toast("Secret copied", "info");
                }}
              />
              <Button
                title="Open authenticator"
                variant="ghost"
                size="sm"
                onPress={async () => {
                  try {
                    await Linking.openURL(setup.otpauth);
                  } catch {
                    toast("No authenticator app found. Copy the secret and enter it manually.", "error");
                  }
                }}
              />
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <CodeField label="2. Enter the current 6-digit code" value={code} onChange={setCode} autoFocus />
            </View>
            <Button title="Enable" onPress={enable} disabled={busy || !code} />
          </View>
        </>
      )}
      {message}
    </Card>
  );
}

export default function Security() {
  const query = useApiQuery<AdminSecurityResponse>(PATH);
  return (
    <Screen onRefresh={query.refetch} contentStyle={{ gap: 20 }}>
      <Stack.Screen options={{ title: "Security" }} />
      <Text variant="title" accessibilityRole="header">Security</Text>
      <Text variant="small">
        Two-factor authentication is strongly recommended for privileged accounts. When enabled, you&apos;ll enter a 6-digit code from your
        authenticator app at login.
      </Text>
      <QueryView query={query}>{(d) => <MfaManager enabled={d.mfaEnabled} />}</QueryView>
    </Screen>
  );
}
