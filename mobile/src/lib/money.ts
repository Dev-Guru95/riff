// Money formatting, mirroring the web's src/lib/money.ts formatMoney().
//
// Amounts arrive from the server in minor units with the currency beside them
// (BillingResponse.currency, DiscountQuote.currency), so the symbol is never
// hardcoded: the same code prints "$0.00" on a USD account and "₦0.00" on an
// NGN one.

export function formatMoney(cents: number, currency: string, locale = "en-US"): string {
  const code = (currency || "usd").toUpperCase();
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: code }).format(cents / 100);
  } catch {
    // Hermes without full ICU, or a currency code Intl doesn't know: never
    // throw in the middle of a checkout summary.
    return `${code} ${(cents / 100).toFixed(2)}`;
  }
}
