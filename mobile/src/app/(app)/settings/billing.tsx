// Billing — what you are on and what it gets you. Read-only.
//
// The web version opens the Stripe Billing Portal from here. The app must not:
// that portal can start and change paid subscriptions, which makes it a
// purchasing mechanism under App Store guideline 3.1.1 and Google Play's
// Payments policy, and linking out to one is the same violation as embedding
// it. Subscriptions are bought, changed and cancelled on the Riff website.
//
// Data: GET /api/mobile/billing.

import { View } from "react-native";
import { router, Stack } from "expo-router";

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

              <Text variant="caption">
                Your plan is managed on the Riff website. Anything you change there appears here
                automatically.
              </Text>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Button title="View plans" variant="ghost" onPress={() => router.push("/pricing")} />
              </View>
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}
