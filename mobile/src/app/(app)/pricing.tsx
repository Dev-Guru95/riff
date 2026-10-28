// Plans — what each tier includes, and which one you are on.
//
// This screen deliberately sells nothing. Pro and Premium unlock digital
// content, so App Store guideline 3.1.1 and Google Play's Payments policy would
// require them to be sold through in-app purchase. Riff sells them on the
// website instead, which means the app must contain no purchase mechanism AND
// no button, link or other call to action pointing at one — a link out is the
// same violation as a checkout screen (outside the US storefront, where the
// 2025 injunctions carved out an exception Riff does not rely on).
//
// So: no prices, no Upgrade buttons, no "subscribe at …" copy, nothing that
// opens a browser. Just what you get, and what you are on. If that ever needs
// to change, the compliant route is StoreKit / Play Billing, not a link.
//
// Data: GET /api/mobile/billing (read-only).

import { View } from "react-native";
import { Stack } from "expo-router";

import { Card, Chip, QueryView, Screen, Text } from "@/components/ui";
import { useApiQuery } from "@/hooks/useApi";
import { openLink } from "@/lib/links";
import { colors } from "@/theme/tokens";
import type { BillingResponse } from "@/types/api";

export default function Pricing() {
  const query = useApiQuery<BillingResponse>("/api/mobile/billing");

  return (
    <Screen onRefresh={query.refetch}>
      <Stack.Screen options={{ title: "Plans" }} />
      <View>
        <Text variant="title">Plans</Text>
        <Text variant="small" style={{ marginTop: 4 }}>
          What each plan includes. Your plan is managed on the Riff website — changes you make
          there show up here automatically.
        </Text>
      </View>
      <QueryView query={query}>
        {(d) => (
          <>
            {d.plans.map((p) => {
              const isCurrent = d.currentPlan === p.key;
              return (
                <Card key={p.key} style={[{ padding: 24 }, isCurrent && { borderColor: colors.brand }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Text variant="heading" weight="bold" style={{ flex: 1 }}>{p.name}</Text>
                    {isCurrent ? <Chip label="Your plan" tone="brand" /> : null}
                  </View>
                  <View style={{ gap: 6 }}>
                    {p.features.map((f) => (
                      <View key={f} style={{ flexDirection: "row", gap: 8 }}>
                        <Text color={isCurrent ? colors.success : colors.muted}>✓</Text>
                        <Text style={{ flex: 1 }} color={isCurrent ? colors.foreground : colors.muted}>{f}</Text>
                      </View>
                    ))}
                  </View>
                </Card>
              );
            })}

            <View style={{ flexDirection: "row", justifyContent: "center", flexWrap: "wrap", columnGap: 20, rowGap: 8, marginTop: 4 }}>
              <Text
                variant="caption"
                color={colors.accent}
                accessibilityRole="link"
                style={{ paddingVertical: 6 }}
                onPress={() => void openLink("/terms")}
              >
                Terms of Use
              </Text>
              <Text
                variant="caption"
                color={colors.accent}
                accessibilityRole="link"
                style={{ paddingVertical: 6 }}
                onPress={() => void openLink("/privacy")}
              >
                Privacy Policy
              </Text>
            </View>
          </>
        )}
      </QueryView>
    </Screen>
  );
}
