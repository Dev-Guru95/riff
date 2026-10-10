// Billing — the web's /settings/billing page.
// Data: GET /api/mobile/billing. Manage: POST /api/billing/portal → Stripe
// Billing Portal in the in-app browser, then the plan is re-read on return.

import { View } from "react-native";
import { router, Stack } from "expo-router";

import { useStripeRedirect } from "@/components/account/useStripeRedirect";
import { Button, Card, QueryView, Screen, Text } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import type { BillingResponse } from "@/types/api";

/** Web: `<li>Label: <strong>value</strong></li>` in text-sm. */
function Line({ label, value }: { label: string; value: string | number }) {
  return (
    <Text>
      {label}: <Text weight="bold">{String(value)}</Text>
    </Text>
  );
}

export default function Billing() {
  const query = useApiQuery<BillingResponse>("/api/mobile/billing");
  const { start, pending } = useStripeRedirect();

  return (
    <Screen onRefresh={query.refetch} contentStyle={{ gap: 20 }}>
      <Stack.Screen options={{ title: "Billing" }} />
      <Text variant="title" accessibilityRole="header">Billing</Text>
      <QueryView query={query}>
        {(d) => {
          const ent = d.entitlements;
          const plan = d.plans.find((p) => p.key === ent.plan);
          const sub = d.subscription;
          return (
            <>
              <Card style={{ padding: 24, gap: 4 }}>
                <Text variant="overline">Current plan</Text>
                <Text variant="title">{plan?.name ?? ent.plan}</Text>
                {sub?.currentPeriodEnd ? (
                  <Text variant="caption">
                    {sub.status === "canceled" ? "Access until" : "Renews"} {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                  </Text>
                ) : null}
                <View style={{ gap: 4, marginTop: 12 }}>
                  <Line label="Coach messages/day" value={ent.coachMessagesPerDay >= 1000 ? "Unlimited" : ent.coachMessagesPerDay} />
                  <Line label="Social connections" value={ent.socialConnections} />
                  <Line label="All courses" value={ent.allCourses ? "Yes" : "No"} />
                  <Line label="Human-reviewed assignments" value={ent.humanReview ? "Yes" : "No"} />
                </View>
              </Card>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {ent.plan === "free" ? (
                  <Button title="Upgrade" onPress={() => router.push("/pricing")} />
                ) : (
                  <Button
                    title={pending ? "Opening…" : "Manage subscription"}
                    loading={pending === "portal"}
                    onPress={() => void start("portal", "/api/billing/portal")}
                  />
                )}
                <Button title="View plans" variant="ghost" onPress={() => router.push("/pricing")} />
              </View>
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}
