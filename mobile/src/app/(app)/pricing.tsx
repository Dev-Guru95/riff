// Plans — the web's /pricing page.
// Data: GET /api/mobile/billing. Upgrade: POST /api/billing/checkout { plan }
// → Stripe Checkout in the in-app browser, then the plan is re-read on return.

import { View } from "react-native";
import { Stack } from "expo-router";

import { useStripeRedirect } from "@/components/account/useStripeRedirect";
import { Button, Card, QueryView, Screen, Text } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { colors, fonts } from "@/theme/tokens";
import type { BillingResponse } from "@/types/api";

export default function Pricing() {
  const query = useApiQuery<BillingResponse>("/api/mobile/billing");
  const { start, pending } = useStripeRedirect();

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: "Plans" }} />
      <View>
        <Text variant="title">Plans</Text>
        <Text variant="small" style={{ marginTop: 4 }}>Upgrade to unlock all courses, unlimited coaching, and full audits.</Text>
      </View>
      <QueryView query={query}>
        {(d) => (
          <>
            {!d.billingConfigured ? (
              <Card>
                <Text>
                  💳 <Text weight="bold">Upgrades are opening soon.</Text> Paid plans aren&apos;t available to purchase just yet — keep learning on Free and we&apos;ll let you know the moment they go live.
                </Text>
              </Card>
            ) : null}

            {d.plans.map((p) => {
              const isCurrent = d.currentPlan === p.key;
              const highlight = p.key === "pro";
              return (
                <Card key={p.key} style={[{ gap: 4 }, highlight && { borderColor: colors.brand }]}>
                  {highlight ? (
                    <Text variant="caption" weight="semibold" color={colors.brand}>MOST POPULAR</Text>
                  ) : null}
                  <Text variant="heading" weight="bold">{p.name}</Text>
                  <Text style={{ fontSize: 30, lineHeight: 38, fontFamily: fonts.bold, color: colors.foreground }}>
                    ${p.priceMonthly}
                    <Text variant="small">/mo</Text>
                  </Text>
                  <View style={{ gap: 6, marginVertical: 10 }}>
                    {p.features.map((f) => (
                      <View key={f} style={{ flexDirection: "row", gap: 8 }}>
                        <Text color={colors.success}>✓</Text>
                        <Text style={{ flex: 1 }}>{f}</Text>
                      </View>
                    ))}
                  </View>
                  {isCurrent ? (
                    <Button title="Current plan" variant="ghost" fullWidth disabled />
                  ) : p.key === "free" ? (
                    <Button title="Free" variant="ghost" fullWidth disabled />
                  ) : (
                    <Button
                      fullWidth
                      title={pending === p.key ? "Redirecting…" : !d.billingConfigured ? "Coming soon" : `Upgrade to ${p.key}`}
                      loading={pending === p.key}
                      disabled={!d.billingConfigured || (pending !== null && pending !== p.key)}
                      onPress={() => void start(p.key, "/api/billing/checkout", { plan: p.key })}
                    />
                  )}
                </Card>
              );
            })}

            {d.billingConfigured ? (
              <Text variant="caption" style={{ textAlign: "center" }}>
                Checkout opens securely in your browser. Your plan updates here when you come back.
              </Text>
            ) : null}
          </>
        )}
      </QueryView>
    </Screen>
  );
}
