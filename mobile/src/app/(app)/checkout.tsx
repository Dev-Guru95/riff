// Checkout — apply a discount code to a plan and, when the code covers the
// whole price, activate it.
//
// What this screen is and is not: it takes no payment. The app still sells
// nothing (App Store 3.1.1 / Play Payments), and POST /api/billing/checkout
// refuses the native client, so a total above zero ends here with "finish on
// the website" rather than a purchase or a link to one. A code that brings the
// total to zero is a redemption, not a sale: POST /api/billing/redeem checks it
// server-side, records it, and switches the plan on.
//
// Every number shown comes from the server (POST /api/billing/discount). The
// app never computes a price and never sends one — it sends the code.
//
// Data: GET /api/mobile/billing. Writes: /api/billing/discount, /api/billing/redeem.

import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";

import { api } from "@/api/client";
import { ApiError, errorMessage } from "@/api/errors";
import { Button, Card, Field, QueryView, Screen, Text, useToast } from "@/components/ui";
import { useApiQuery, useInvalidate } from "@/hooks/useApi";
import { formatMoney } from "@/lib/money";
import { colors } from "@/theme/tokens";
import type { BillingResponse, DiscountQuote, PlanKey, RedeemResponse } from "@/types/api";

function Row({ label, value, tone, strong }: { label: string; value: string; tone?: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text variant={strong ? "body" : "small"} weight={strong ? "semibold" : "regular"} color={tone}>
        {label}
      </Text>
      <Text variant={strong ? "body" : "small"} weight={strong ? "semibold" : "regular"} color={tone}>
        {value}
      </Text>
    </View>
  );
}

export default function Checkout() {
  const params = useLocalSearchParams<{ plan?: string }>();
  // Pro is the only purchasable plan; anything else in the deep link
  // resolves to it rather than opening a checkout for a retired tier.
  const plan: PlanKey = "pro";

  const query = useApiQuery<BillingResponse>("/api/mobile/billing");
  const invalidate = useInvalidate();
  const toast = useToast();

  const [code, setCode] = useState("");
  const [quote, setQuote] = useState<DiscountQuote | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState<RedeemResponse | null>(null);

  async function applyCode() {
    const value = code.trim();
    if (!value || applying) return;
    setApplying(true);
    setCodeError(null);
    setQuote(null);
    try {
      const res = await api<{ discount: DiscountQuote }>("/api/billing/discount", {
        method: "POST",
        body: { plan, code: value },
      });
      setQuote(res.discount);
    } catch (err) {
      // The server writes the user-facing reason ("That code has expired.",
      // "You've already used that code."), so show it rather than a generic one.
      setCodeError(errorMessage(err));
    } finally {
      setApplying(false);
    }
  }

  function clearCode() {
    setCode("");
    setQuote(null);
    setCodeError(null);
  }

  async function activate() {
    if (!quote?.free || activating) return;
    setActivating(true);
    setCodeError(null);
    try {
      // The code again, never the price: /api/billing/redeem re-quotes it and
      // refuses anything that doesn't come to zero.
      const res = await api<RedeemResponse>("/api/billing/redeem", {
        method: "POST",
        body: { plan, code: quote.code },
      });
      setActivated(res);
      await invalidate("/api/mobile/billing", "/api/mobile/me", "/api/mobile/dashboard", "/api/mobile/missions");
      toast(`${quote.planName} is active.`);
    } catch (err) {
      setCodeError(err instanceof ApiError && err.message ? err.message : errorMessage(err));
    } finally {
      setActivating(false);
    }
  }

  return (
    <Screen onRefresh={query.refetch} contentStyle={{ gap: 20 }}>
      <Stack.Screen options={{ title: "Checkout" }} />
      <QueryView query={query}>
        {(d) => {
          const info = d.plans.find((p) => p.key === plan);
          const currency = quote?.currency ?? d.currency;
          const money = (cents: number) => formatMoney(cents, currency);
          const originalCents = quote?.originalCents ?? info?.priceCents ?? 0;
          const discountCents = quote?.discountCents ?? 0;
          const finalCents = quote?.finalCents ?? originalCents;

          if (activated) {
            return (
              <Card style={{ padding: 24, gap: 10, alignItems: "center" }}>
                <Text style={{ fontSize: 40, lineHeight: 48 }}>🎉</Text>
                <Text variant="heading" weight="bold" style={{ textAlign: "center" }}>
                  {info?.name ?? plan} is active
                </Text>
                <Text variant="small" style={{ textAlign: "center" }}>
                  Your code covered the full price, so nothing was charged.
                  {activated.currentPeriodEnd
                    ? ` Access runs to ${new Date(activated.currentPeriodEnd).toLocaleDateString()}.`
                    : ""}
                </Text>
                <Button title="See what's unlocked" fullWidth onPress={() => router.replace("/settings/billing")} />
              </Card>
            );
          }

          return (
            <>
              <View>
                <Text variant="title">Checkout</Text>
                <Text variant="small" style={{ marginTop: 4 }}>
                  {info?.name ?? plan} — {money(info?.priceCents ?? 0)} a month. Have a code? Apply it below.
                </Text>
                {/* The offer is shown, not sold: annual billing and the
                    discounted rate are bought on the website, which is the
                    only place that takes payment at all. */}
                {d.promo ? (
                  <Text variant="small" color={colors.accent} style={{ marginTop: 6 }}>
                    {d.promo.badge} · {d.promo.name} — {d.promo.percentOff}% off every plan, monthly or annual, on
                    the Riff website until {new Date(d.promo.endsAt).toLocaleDateString()}.
                  </Text>
                ) : null}
              </View>

              {/* Discount code */}
              <Card style={{ padding: 20, gap: 12 }}>
                <Text weight="semibold">Discount code</Text>
                <Field
                  label="Code"
                  value={code}
                  onChangeText={(t) => {
                    // Codes are stored uppercase; matching the input to that
                    // means "riff100" and "RIFF100" behave the same.
                    setCode(t.toUpperCase());
                    setQuote(null);
                    setCodeError(null);
                  }}
                  // Never a code-shaped example: "e.g. RIFF100" read as a real
                  // code and got typed in verbatim.
                  placeholder="Enter your code"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={64}
                  editable={!applying}
                  returnKeyType="done"
                  onSubmitEditing={() => void applyCode()}
                  error={codeError}
                />
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  <Button
                    title={applying ? "Checking…" : "Apply code"}
                    onPress={() => void applyCode()}
                    loading={applying}
                    disabled={!code.trim()}
                  />
                  {quote ? <Button title="Remove" variant="ghost" onPress={clearCode} /> : null}
                </View>
                {quote ? (
                  <Text variant="small" color={colors.success} accessibilityLiveRegion="polite">
                    ✓ Code {quote.code} applied{quote.description ? ` — ${quote.description}` : ""}.
                    {quote.free
                      ? quote.durationMonths > 0
                        ? ` ${quote.durationMonths} month${quote.durationMonths === 1 ? "" : "s"} free.`
                        : " Free access."
                      : ""}
                  </Text>
                ) : null}
              </Card>

              {/* Summary */}
              <Card style={{ padding: 20, gap: 8 }}>
                <Text weight="semibold" style={{ marginBottom: 4 }}>Summary</Text>
                <Row label={`${info?.name ?? plan} plan`} value={money(originalCents)} />
                <Row
                  label={quote ? `Discount (${quote.code})` : "Discount"}
                  value={discountCents > 0 ? `−${money(discountCents)}` : money(0)}
                  tone={discountCents > 0 ? colors.success : undefined}
                />
                <View style={styles.divider} />
                <Row label="Total due today" value={money(finalCents)} strong />
                {finalCents === 0 && quote ? (
                  <Text variant="caption" color={colors.success}>
                    Nothing to pay — activate below.
                  </Text>
                ) : null}
              </Card>

              {quote?.free ? (
                <Button
                  title={activating ? "Activating…" : `Activate ${info?.name ?? plan} for ${money(0)}`}
                  onPress={() => void activate()}
                  loading={activating}
                  fullWidth
                />
              ) : (
                // No purchase mechanism and no call to action pointing at one:
                // paid plans are bought on the website, and saying where is not
                // the same as linking there.
                <Card style={{ padding: 20, gap: 6 }}>
                  <Text weight="semibold">Paid plans are managed on the Riff website</Text>
                  <Text variant="small">
                    {quote
                      ? "This code reduces the price but doesn't cover it, so there's still an amount to pay. Sign in on the Riff website to finish — your code works there too."
                      : "Riff doesn't take payments in the app. Sign in on the Riff website to change your plan; anything you change there shows up here automatically."}
                  </Text>
                </Card>
              )}

              <Button title="Back to plans" variant="ghost" onPress={() => router.back()} />
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
});
