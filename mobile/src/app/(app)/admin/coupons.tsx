// Coupons & Rewards — the web's /admin/coupons (page.tsx + CouponsClient.tsx):
// the Top-1000 rewards card, the create form (Code, Type, Value, Max uses,
// Description), then the coupon table (Code, Value, Description, Redeemed) as rows.
// Data: GET /api/mobile/admin/coupons. Writes (admin only, server-checked):
// POST /api/admin/coupons, POST /api/admin/rewards/issue.

import { useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";

import { useStaffAccess } from "@/components/admin/access";
import { InlineMsg, MONO, NumberField, OptionPicker, ViewOnlyNote } from "@/components/admin/controls";
import { fieldErrorMessage, useAdminCall } from "@/components/admin/useAdminAction";
import { Button, Card, Divider, Field, QueryView, Screen, Text } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { colors, fonts } from "@/theme/tokens";
import type { AdminCouponsResponse } from "@/types/api";

const PATH = "/api/mobile/admin/coupons";
const TYPES = ["percent", "fixed", "reward"] as const;

type RewardsResult = { ranked: number; rewarded: number; notified: number; period: string };

function IssueRewardsButton() {
  const { call, busy } = useAdminCall([]);
  const [msg, setMsg] = useState<string | null>(null);

  async function issue() {
    setMsg(null);
    const res = await call<RewardsResult>("/api/admin/rewards/issue", "POST", { topN: 1000, code: "TOP1000" });
    if (res.ok) {
      const d = res.data;
      setMsg(`Snapshotted ${d.ranked} artists · rewarded top ${d.rewarded} · ${d.notified} notified (period ${d.period}).`);
    } else if (res.error) {
      setMsg(res.error || "Failed");
    }
  }

  return (
    <Card style={{ gap: 12 }}>
      <View>
        <Text weight="semibold">Issue Top-1000 leaderboard rewards</Text>
        <Text variant="caption">Snapshots the global board and notifies qualifying artists with the reward code.</Text>
        {msg ? <Text variant="caption" color={colors.accent} style={{ marginTop: 4 }}>{msg}</Text> : null}
      </View>
      <Button title={busy ? "Issuing…" : "Issue rewards"} onPress={issue} disabled={busy} />
    </Card>
  );
}

function CreateCouponForm() {
  const { call, busy } = useAdminCall([PATH]);
  const [code, setCode] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("percent");
  const [value, setValue] = useState(20);
  const [description, setDescription] = useState("");
  const [maxRedemptions, setMax] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    const res = await call("/api/admin/coupons", "POST", { code, type, value, description, maxRedemptions });
    if (res.ok) {
      setCode("");
      setDescription("");
    } else if (res.error) {
      setErr(fieldErrorMessage(res.body) ?? (res.error || "Failed"));
    }
  }

  return (
    <Card style={{ gap: 8 }}>
      <Field label="Code" placeholder="SUMMER25" value={code} onChangeText={(t) => setCode(t.toUpperCase())} autoCapitalize="characters" autoCorrect={false} />
      <OptionPicker label="Type" value={type} options={TYPES} onChange={setType} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <NumberField label="Value" value={value} onChange={setValue} />
        </View>
        <View style={{ flex: 1 }}>
          {/* 0 = unlimited (the web field's title). */}
          <NumberField label="Max uses" value={maxRedemptions} onChange={(n) => setMax(Math.max(0, n || 0))} hint="0 = unlimited" />
        </View>
      </View>
      <Field label="Description" value={description} onChangeText={setDescription} />
      <Button title="Create" onPress={submit} disabled={busy || !code} />
      {err ? <InlineMsg ok={false}>{err}</InlineMsg> : null}
    </Card>
  );
}

export default function AdminCoupons() {
  const query = useApiQuery<AdminCouponsResponse>(PATH);
  const { role, can } = useStaffAccess();
  const canEdit = can("admin");

  return (
    <Screen onRefresh={query.refetch} contentStyle={{ gap: 20 }}>
      <Stack.Screen options={{ title: "Coupons" }} />
      <Text variant="title" accessibilityRole="header">Coupons & Rewards</Text>
      <Text variant="small" style={{ marginTop: -8 }}>
        Create discount codes. The <Text variant="small" style={{ fontFamily: MONO }}>TOP1000</Text> reward auto-applies to top leaderboard ranks.
      </Text>

      {canEdit ? (
        <>
          <IssueRewardsButton />
          <CreateCouponForm />
        </>
      ) : (
        <ViewOnlyNote role={role} needs="admin" />
      )}

      <QueryView query={query}>
        {(d) => (
          <Card padded={false} style={{ overflow: "hidden" }}>
            {/* Table header (Description sits under each code at phone width). */}
            <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
              <Text variant="caption" style={{ flex: 1 }}>Code · Description</Text>
              <Text variant="caption">Value</Text>
              <Text variant="caption" style={{ minWidth: 56, textAlign: "right" }}>Redeemed</Text>
            </View>
            <Divider />
            {d.coupons.map((c, i) => (
              <View key={c.id}>
                {i > 0 ? <Divider /> : null}
                <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Text selectable style={{ flex: 1, fontFamily: MONO, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>
                      {c.code}
                    </Text>
                    <Text>{c.type === "percent" ? `${c.value}%` : c.type === "fixed" ? `$${c.value}` : "reward"}</Text>
                    <Text variant="caption" style={{ minWidth: 56, textAlign: "right" }} accessibilityLabel={`Redeemed ${c.redeemed} of ${c.maxRedemptions || "unlimited"}`}>
                      {c.redeemed}/{c.maxRedemptions || "∞"}
                    </Text>
                  </View>
                  {c.description ? (
                    <Text variant="small" numberOfLines={1}>{c.description}</Text>
                  ) : null}
                </View>
              </View>
            ))}
            {d.coupons.length === 0 ? (
              <View style={{ paddingHorizontal: 16, paddingVertical: 24 }}>
                <Text variant="small" style={{ textAlign: "center", fontFamily: fonts.regular }}>No coupons yet.</Text>
              </View>
            ) : null}
          </Card>
        )}
      </QueryView>
    </Screen>
  );
}
