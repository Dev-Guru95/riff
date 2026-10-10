// Social Media Audit — the web's /audit page + AuditClient.
// Data: GET /api/mobile/audit. Writes: POST/DELETE /api/social/connect (manual
// handle), POST /api/audit/run.
//
// The web's OAuth "Connect" buttons go through /api/social/oauth/:platform/start,
// a cookie-based browser redirect flow that can't carry the app's Bearer session,
// so every platform is connected here by handle (the web's manual path).

import { useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Stack } from "expo-router";

import { Button, Card, Icon, ProgressBar, QueryView, Screen, Text } from "@/components/ui";
import { useApiMutation, useApiQuery } from "@/hooks/useApi";
import { colors, fonts, radius, TOUCH } from "@/theme/tokens";
import type { AuditResponse } from "@/types/api";

const PLATFORMS = [
  { key: "instagram", label: "Instagram", icon: "📷" },
  { key: "tiktok", label: "TikTok", icon: "🎵" },
  { key: "youtube", label: "YouTube", icon: "▶️" },
  { key: "facebook", label: "Facebook", icon: "👍" },
  { key: "x", label: "X", icon: "✖️" },
  { key: "spotify", label: "Spotify for Artists", icon: "🎧" },
];

const AUDIT_PATH = "/api/mobile/audit";

function ScoreCard({ label, score, delta }: { label: string; score: number; delta?: number }) {
  const color = score >= 75 ? colors.success : score >= 50 ? colors.warning : colors.brand2;
  return (
    <Card style={{ flex: 1, minWidth: 0, gap: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text variant="small">{label}</Text>
        {delta != null && delta !== 0 ? (
          <Text variant="caption" color={delta > 0 ? colors.success : colors.brand2}>
            {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}
          </Text>
        ) : null}
      </View>
      <Text style={{ fontSize: 30, lineHeight: 36, fontFamily: fonts.bold, color }}>{score}</Text>
      <ProgressBar pct={score} height={6} />
    </Card>
  );
}

function PlatformRow({
  platform,
  account,
}: {
  platform: (typeof PLATFORMS)[number];
  account: AuditResponse["accounts"][number] | undefined;
}) {
  const [editing, setEditing] = useState(false);
  const [handle, setHandle] = useState("");
  const connect = useApiMutation({
    invalidates: [AUDIT_PATH],
    success: `${platform.label} connected`,
    onSuccess: () => {
      setEditing(false);
      setHandle("");
    },
  });
  const disconnect = useApiMutation({ invalidates: [AUDIT_PATH], success: `${platform.label} disconnected` });

  function submit() {
    const clean = handle.trim().replace(/^@/, "");
    if (!clean) return;
    connect.mutate({ path: "/api/social/connect", body: { platform: platform.key, handle: clean } });
  }

  function confirmDisconnect() {
    Alert.alert(`Disconnect ${platform.label}?`, "Future audits won't include this account.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Disconnect",
        style: "destructive",
        onPress: () => disconnect.mutate({ path: `/api/social/connect?platform=${encodeURIComponent(platform.key)}`, method: "DELETE" }),
      },
    ]);
  }

  return (
    <View style={styles.platform}>
      <View style={styles.platformHead}>
        <Text numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>
          {platform.icon}  {platform.label}
        </Text>
        {account ? (
          <Text variant="caption" color={colors.success} numberOfLines={1} style={{ flexShrink: 1 }}>
            {account.connectVia === "oauth" ? "🔗 connected" : `@${account.handle}`}
          </Text>
        ) : null}
        {account ? (
          <Pressable
            onPress={confirmDisconnect}
            disabled={disconnect.isPending}
            accessibilityRole="button"
            accessibilityLabel={`Disconnect ${platform.label}`}
            hitSlop={8}
            style={styles.remove}
          >
            {({ pressed }) => <Text variant="caption" color={pressed ? colors.brand2 : colors.muted}>✕</Text>}
          </Pressable>
        ) : !editing ? (
          <Button title="Connect" size="sm" variant="ghost" onPress={() => setEditing(true)} accessibilityLabel={`Connect ${platform.label}`} />
        ) : null}
      </View>
      {!account && editing ? (
        <View style={styles.connectRow}>
          <TextInput
            autoFocus
            value={handle}
            onChangeText={setHandle}
            placeholder="@handle"
            placeholderTextColor={colors.muted}
            selectionColor={colors.brand}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={65}
            returnKeyType="done"
            onSubmitEditing={submit}
            style={styles.input}
            accessibilityLabel={`${platform.label} handle`}
          />
          <Button title="Add" size="sm" onPress={submit} loading={connect.isPending} disabled={!handle.trim()} />
          <Button
            title="Cancel"
            size="sm"
            variant="link"
            onPress={() => {
              setEditing(false);
              setHandle("");
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

export default function Audit() {
  const query = useApiQuery<AuditResponse>(AUDIT_PATH);
  const run = useApiMutation({ invalidates: [AUDIT_PATH], success: "Audit complete" });

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: "Social Audit" }} />
      <View>
        <Text variant="title">📈 Social Media Audit</Text>
        <Text variant="small" style={{ marginTop: 4 }}>
          Connect your platforms and track Marketing, Branding, Growth & Consistency scores month over month.
        </Text>
      </View>
      <QueryView query={query}>
        {(d) => {
          const connectedCount = d.accounts.length;
          const report = d.report;
          return (
            <>
              <Card style={{ padding: 20 }}>
                <Text variant="label" style={styles.sectionTitle}>Connected accounts</Text>
                <View style={{ gap: 8 }}>
                  {PLATFORMS.map((p) => (
                    <PlatformRow key={p.key} platform={p} account={d.accounts.find((a) => a.platform === p.key)} />
                  ))}
                </View>
                <View style={{ marginTop: 16, gap: 8 }}>
                  <Button
                    fullWidth
                    title={run.isPending ? "Analyzing your accounts…" : d.runCount > 0 ? "Run this month's audit" : "Run my first audit"}
                    loading={run.isPending}
                    disabled={connectedCount === 0}
                    onPress={() => run.mutate({ path: "/api/audit/run" })}
                  />
                  {connectedCount === 0 ? (
                    <Text variant="caption" style={{ textAlign: "center" }}>Connect at least one account to run an audit.</Text>
                  ) : null}
                  {d.oauthProviders.length > 0 ? (
                    // The web's OAuth Connect is a cookie-based browser redirect the
                    // app's Bearer session can't drive, so the app adds by handle.
                    <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-start" }}>
                      <Icon name="lock" size={13} color={colors.muted} />
                      <Text variant="caption" style={{ flex: 1 }}>
                        In the app, accounts are added by handle. One-tap sign-in with a platform is available on the Riff website.
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Card>

              {report ? (
                <>
                  <View style={{ gap: 12 }}>
                    <View style={{ flexDirection: "row", gap: 12 }}>
                      <ScoreCard label="Marketing" score={report.marketingScore} delta={report.deltas.marketing} />
                      <ScoreCard label="Branding" score={report.brandingScore} delta={report.deltas.branding} />
                    </View>
                    <View style={{ flexDirection: "row", gap: 12 }}>
                      <ScoreCard label="Growth" score={report.growthScore} delta={report.deltas.growth} />
                      <ScoreCard label="Consistency" score={report.consistencyScore} delta={report.deltas.consistency} />
                    </View>
                  </View>

                  <Card style={{ padding: 20 }}>
                    <Text variant="label" style={styles.sectionTitle}>Recommendations</Text>
                    <View style={{ gap: 8 }}>
                      {report.recommendations.map((r, i) => (
                        <View key={i} style={{ flexDirection: "row", gap: 8 }}>
                          <Text color={colors.accent}>→</Text>
                          <Text style={{ flex: 1 }}>{r}</Text>
                        </View>
                      ))}
                    </View>
                    <Text variant="caption" style={{ marginTop: 16 }}>
                      Last run {new Date(report.createdAt).toLocaleDateString()} · audits build month over month.
                    </Text>
                  </Card>
                </>
              ) : null}
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Web: `border rounded-lg px-3 py-2`, label left, status + action right.
  platform: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, gap: 8 },
  platformHead: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 36 },
  remove: { minWidth: 28, minHeight: 28, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  connectRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    flex: 1,
    minHeight: TOUCH,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.field,
    paddingHorizontal: 12,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.foreground,
  },
});
