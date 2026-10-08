// Security — the web's /admin/security (SecurityClient.tsx): two-factor auth
// for the signed-in staff account. Data: GET /api/mobile/admin/security.
// Writes: POST /api/auth/mfa/setup → { secret, otpauth }, /enable { code },
// /disable { code }.
//
// A wrong code makes /enable and /disable answer 401 ("Invalid code"), which
// the shared client would otherwise treat as an expired session and sign the
// user out — so these calls pass skipAuthRedirect.

import { useState } from "react";
import { Linking, View } from "react-native";
import { Stack } from "expo-router";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";

import { api } from "@/api/client";
import { errorMessage } from "@/api/errors";
import { useAuth } from "@/auth/AuthProvider";
import { Quote } from "@/components/admin/controls";
import { Button, Card, Field, QueryView, Screen, Text, useToast } from "@/components/ui";
import { useApiQuery, useInvalidate } from "@/hooks/useApi";
import { colors, radius } from "@/theme/tokens";
import type { AdminSecurityResponse } from "@/types/api";

const PATH = "/api/mobile/admin/security";

type Setup = { secret: string; otpauth: string };

function useMfaCall() {
  const toast = useToast();
  const invalidate = useInvalidate();
  const { refreshUser } = useAuth();
  const [busy, setBusy] = useState(false);

  async function call<T>(path: string, body: unknown, success?: string): Promise<T | undefined> {
    setBusy(true);
    try {
      const res = await api<T>(path, { method: "POST", body, skipAuthRedirect: true });
      if (success) toast(success);
      return res;
    } catch (err) {
      toast(errorMessage(err), "error");
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    await invalidate(PATH);
    await refreshUser(); // /api/mobile/me carries mfaEnabled too
  }

  return { call, refresh, busy };
}

function MfaManager({ enabled }: { enabled: boolean }) {
  const toast = useToast();
  const { call, refresh, busy } = useMfaCall();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");

  const codeOk = code.trim().length >= 6 && code.trim().length <= 8;

  async function startSetup() {
    const d = await call<Setup>("/api/auth/mfa/setup", {});
    if (d) setSetup(d);
  }

  async function enable() {
    const d = await call("/api/auth/mfa/enable", { code: code.trim() }, "MFA enabled ✓");
    if (d) {
      setSetup(null);
      setCode("");
      await refresh();
    }
  }

  async function disable() {
    const d = await call("/api/auth/mfa/disable", { code: code.trim() }, "MFA disabled");
    if (d) {
      setCode("");
      await refresh();
    }
  }

  async function copySecret() {
    if (!setup) return;
    await Clipboard.setStringAsync(setup.secret);
    toast("Secret copied", "info");
  }

  async function openAuthenticator() {
    if (!setup) return;
    try {
      await Linking.openURL(setup.otpauth);
    } catch {
      toast("No authenticator app found. Copy the secret and enter it manually.", "error");
    }
  }

  if (enabled) {
    return (
      <Card style={{ gap: 12 }}>
        <Text weight="semibold" color={colors.success}>🔐 MFA is enabled</Text>
        <Field
          label="Enter a code to disable"
          placeholder="000000"
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, ""))}
          keyboardType="number-pad"
          inputMode="numeric"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={8}
        />
        <Button title="Disable MFA" variant="danger" onPress={disable} loading={busy} disabled={!codeOk} />
      </Card>
    );
  }

  if (!setup) {
    return (
      <Card style={{ gap: 12 }}>
        <Text>MFA is off. Staff accounts can change roles, content and payments, so protect yours with an authenticator app.</Text>
        <Button title="Set up MFA" onPress={startSetup} loading={busy} />
      </Card>
    );
  }

  return (
    <Card style={{ gap: 14 }}>
      <Text>1. Add this account to your authenticator app.</Text>
      <View style={{ alignSelf: "center", padding: 12, backgroundColor: colors.white, borderRadius: radius.card }} accessibilityLabel="QR code for your authenticator app">
        <QRCode value={setup.otpauth} size={180} color={colors.background} backgroundColor={colors.white} />
      </View>
      <Button title="Open in authenticator app" variant="ghost" icon="lock" fullWidth onPress={openAuthenticator} />
      <Text variant="caption">Or enter this secret manually:</Text>
      <Quote>
        <Text selectable weight="semibold" style={{ letterSpacing: 1 }}>{setup.secret}</Text>
      </Quote>
      <Button title="Copy secret" variant="ghost" size="sm" icon="clipboard" onPress={copySecret} />
      <Text variant="caption" selectable numberOfLines={3}>{setup.otpauth}</Text>

      <Field
        label="2. Enter the current 6-digit code"
        placeholder="000000"
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, ""))}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={8}
      />
      <Button title="Enable MFA" onPress={enable} loading={busy} disabled={!codeOk} />
      <Button
        title="Cancel"
        variant="link"
        size="sm"
        onPress={() => {
          setSetup(null);
          setCode("");
        }}
      />
    </Card>
  );
}

export default function Security() {
  const query = useApiQuery<AdminSecurityResponse>(PATH);
  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: "Security" }} />
      <QueryView query={query}>
        {(d) => (
          <>
            <View style={{ gap: 4 }}>
              <Text variant="title">Two-factor authentication</Text>
              <Text variant="small">Protect {d.email} with a code from an authenticator app at sign-in.</Text>
            </View>
            <MfaManager enabled={d.mfaEnabled} />
          </>
        )}
      </QueryView>
    </Screen>
  );
}
