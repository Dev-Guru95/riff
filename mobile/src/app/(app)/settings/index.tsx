// Settings — the web's /settings page: account details, billing + privacy
// links, log out, and in-app account deletion (required by Play's User Data
// policy). Data: GET /api/mobile/me.
// Delete: DELETE /api/account { password, confirm: "DELETE" } — same
// re-authentication and typed confirmation as the web form.

import { useState } from "react";
import { Alert, View } from "react-native";
import { router, Stack } from "expo-router";

import { api } from "@/api/client";
import { ApiError, errorMessage } from "@/api/errors";
import { forgetStoredSession, useAuth } from "@/auth/AuthProvider";
import { Button, Card, Divider, Field, ListRow, QueryView, Screen, Text } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { openLink } from "@/lib/links";
import { colors } from "@/theme/tokens";
import type { MeResponse } from "@/types/api";

function Line({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <Text variant="small">{label}</Text>
      <Text numberOfLines={1} style={[{ flexShrink: 1, textAlign: "right" }, capitalize && { textTransform: "capitalize" }]}>
        {value}
      </Text>
    </View>
  );
}

// Deleting an account is irreversible, so the form is deliberately awkward:
// collapsed until asked for, then the password and the word DELETE typed out,
// then a final native confirmation.
function DeleteAccountForm() {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ready = password.length > 0 && confirm === "DELETE";

  async function performDelete() {
    setErr(null);
    setLoading(true);
    try {
      // skipAuthRedirect: a wrong password is a 401 and must not sign the user out.
      const res = await api<{ deleted: boolean; billingNeedsAttention?: boolean }>("/api/account", {
        method: "DELETE",
        body: { password, confirm },
        skipAuthRedirect: true,
      });
      // The account no longer exists: drop the stored token and return to login.
      await forgetStoredSession();
      await logout();
      Alert.alert(
        "Account deleted",
        res?.billingNeedsAttention
          ? "Your account and its data have been permanently deleted. We couldn't reach the billing provider to cancel your subscription — please check your Stripe receipts or contact support so you aren't charged again."
          : "Your account and its data have been permanently deleted.",
      );
    } catch (e) {
      setErr(
        e instanceof ApiError && (e.kind === "network" || e.kind === "timeout")
          ? "Could not reach the server. Check your connection and try again."
          : e instanceof ApiError
            ? e.message || "Could not delete your account. Please try again."
            : errorMessage(e),
      );
      setLoading(false);
    }
  }

  function submit() {
    if (!ready || loading) return;
    Alert.alert("Delete your account permanently?", "This cannot be undone and support cannot restore it.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete forever", style: "destructive", onPress: () => void performDelete() },
    ]);
  }

  if (!open) return <Button title="Delete my account" variant="danger" onPress={() => setOpen(true)} />;

  return (
    <View style={{ gap: 12 }}>
      <Field
        label="Confirm your password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
      />
      <Field
        label="Type DELETE to confirm"
        value={confirm}
        onChangeText={setConfirm}
        placeholder="DELETE"
        autoCapitalize="characters"
        autoCorrect={false}
        editable={!loading}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      {err ? (
        <Text color={colors.danger} accessibilityLiveRegion="polite">{err}</Text>
      ) : null}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Button title={loading ? "Deleting…" : "Permanently delete"} variant="danger" disabled={!ready} loading={loading} onPress={submit} />
        <Button
          title="Cancel"
          variant="ghost"
          disabled={loading}
          onPress={() => {
            setOpen(false);
            setPassword("");
            setConfirm("");
            setErr(null);
          }}
        />
      </View>
    </View>
  );
}

export default function Settings() {
  const { logout } = useAuth();
  const query = useApiQuery<MeResponse>("/api/mobile/me");

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: "Settings" }} />
      <View>
        <Text variant="title">Settings</Text>
        <Text variant="small" style={{ marginTop: 4 }}>Your account and data</Text>
      </View>
      <QueryView query={query}>
        {(me) => (
          <>
            <Card style={{ gap: 10 }}>
              <Text weight="semibold">Account</Text>
              <Line label="Email" value={me.user.email} />
              <Line label="Artist name" value={me.profile?.stageName ?? "—"} />
              <Line label="Member since" value={new Date(me.user.createdAt).toLocaleDateString()} />
              <Line label="Two-factor" value={me.user.mfaEnabled ? "On" : "Off"} />
              <Line label="Plan" value={me.plan} capitalize />
            </Card>

            <Card padded={false} style={{ overflow: "hidden" }}>
              <ListRow icon="card" title="Billing" subtitle="Plan, renewal and subscription" onPress={() => router.push("/settings/billing")} />
              <Divider />
              <ListRow icon="shield" title="Privacy policy" onPress={() => void openLink("/privacy")} />
              <Divider />
              <ListRow
                icon="logout"
                title="Log out"
                onPress={() =>
                  Alert.alert("Log out?", "You'll need to log in again on this device.", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Log out", style: "destructive", onPress: () => void logout() },
                  ])
                }
              />
            </Card>

            <Card style={{ gap: 10, borderColor: colors.brand2 }}>
              <Text weight="semibold">Delete account</Text>
              <Text variant="small">
                Permanently deletes your account and everything in it — progress, XP, badges, certificates, boards, Studio data, coach history and community posts. This cannot be undone and support cannot restore it.
                {me.subscription?.status === "active" ? " Your subscription will be cancelled." : ""}
              </Text>
              <DeleteAccountForm />
            </Card>
          </>
        )}
      </QueryView>
    </Screen>
  );
}
