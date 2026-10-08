// Coupons & Rewards — the web's /admin/coupons. Data: GET /api/mobile/admin/coupons.
// Writes (admin only): POST /api/admin/coupons, POST /api/admin/rewards/issue.

import { useState } from "react";
import { Alert, View } from "react-native";
import { Stack } from "expo-router";

import { useStaffAccess } from "@/components/admin/access";
import { NumberField, OptionPicker, ViewOnlyNote } from "@/components/admin/controls";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button, Card, Chip, EmptyState, Field, QueryView, Screen, Text } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { colors } from "@/theme/tokens";
import type { AdminCouponsResponse } from "@/types/api";

const PATH = "/api/mobile/admin/coupons";
const TYPES = ["percent", "fixed", "reward"] as const;

type RewardsResult = { ranked: number; rewarded: number; notified: number; period: string };

function IssueRewards() {
  const { run, busy } = useAdminAction([]);
  const [msg, setMsg] = useState<string | null>(null);

  function issue() {
    Alert.alert(
      "Issue Top-1000 rewards?",
      "This snapshots the global leaderboard and notifies every qualifying artist with the TOP1000 code.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Issue rewards",
          onPress: async () => {
            setMsg(null);
            const d = await run<RewardsResult>("/api/admin/rewards/issue", "POST", { topN: 1000, code: "TOP1000" }, "Rewards issued");
            if (d) setMsg(`Snapshotted ${d.ranked} artists · rewarded top ${d.rewarded} · ${d.notified} notified (period ${d.period}).`);
          },
        },
      ],
    );
  }

  return (
    <Card style={{ gap: 10 }}>
      <Text weight="semibold">Issue Top-1000 leaderboard rewards</Text>
      <Text variant="caption">Snapshots the global board and notifies qualifying artists with the reward code.</Text>
      {msg ? <Text variant="caption" color={colors.accent}>{msg}</Text> : null}
      <Button title="Issue rewards" onPress={issue} loading={busy} />
    </Card>
  );
}

function CreateCoupon() {
  const { run, busy } = useAdminAction([PATH]);
  const [code, setCode] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("percent");
  const [value, setValue] = useState(20);
  const [maxRedemptions, setMax] = useState(0);
  const [description, setDescription] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (code.length < 3 || !/^[A-Z0-9_-]+$/.test(code)) return setErr("Code: at least 3 characters — uppercase letters, numbers, - and _ only.");
    setErr(null);
    const res = await run(
      "/api/admin/coupons",
      "POST",
      { code, type, value: Math.max(0, value), description, maxRedemptions: Math.max(0, maxRedemptions) },
      `Coupon ${code} created`,
    );
    if (res) {
      setCode("");
      setDescription("");
    }
  }

  return (
    <Card style={{ gap: 12 }}>
      <Text variant="heading">New coupon</Text>
      <Field
        label="Code"
        placeholder="SUMMER25"
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase().replace(/\s/g, ""))}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <OptionPicker label="Type" value={type} options={TYPES} onChange={setType} />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <NumberField label={type === "percent" ? "Value (%)" : type === "fixed" ? "Value ($)" : "Value"} value={value} onChange={setValue} />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField label="Max uses" value={maxRedemptions} onChange={setMax} hint="0 = unlimited" />
        </View>
      </View>
      <Field label="Description" value={description} onChangeText={setDescription} />
      {err ? <Text variant="caption" color={colors.danger}>{err}</Text> : null}
      <Button title="Create coupon" onPress={submit} loading={busy} disabled={!code} />
    </Card>
  );
}

export default function AdminCoupons() {
  const query = useApiQuery<AdminCouponsResponse>(PATH);
  const { role, can } = useStaffAccess();
  const canEdit = can("admin");

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: "Coupons & Rewards" }} />
      <Text variant="small">Create discount codes. The TOP1000 reward auto-applies to top leaderboard ranks.</Text>

      {canEdit ? (
        <>
          <IssueRewards />
          <CreateCoupon />
        </>
      ) : (
        <ViewOnlyNote role={role} needs="admin" />
      )}

      <QueryView query={query} isEmpty={(d) => d.coupons.length === 0} empty={<EmptyState icon="ticket" title="No coupons yet." />}>
        {(d) => (
          <View style={{ gap: 10 }}>
            {d.coupons.map((c) => (
              <Card key={c.id} style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text weight="bold" selectable style={{ flex: 1 }}>{c.code}</Text>
                  <Text weight="semibold">{c.type === "percent" ? `${c.value}%` : c.type === "fixed" ? `$${c.value}` : "reward"}</Text>
                </View>
                {c.description ? <Text variant="small">{c.description}</Text> : null}
                <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                  <Chip label={c.active ? "active" : "inactive"} tone={c.active ? "success" : "muted"} />
                  <Text variant="caption">Redeemed {c.redeemed}/{c.maxRedemptions || "∞"}</Text>
                  {c.expiresAt ? <Text variant="caption">· expires {new Date(c.expiresAt).toLocaleDateString()}</Text> : null}
                </View>
              </Card>
            ))}
          </View>
        )}
      </QueryView>
    </Screen>
  );
}
