import { describe, it, expect } from "vitest";
import {
  accessMonthsFor,
  campaignDiscount,
  discountFor,
  evaluateCoupon,
  normalizeCode,
  planPriceCents,
  promoPeriodEnd,
  type CouponRules,
  type DiscountQuote,
} from "./coupons";
import { formatMoney } from "./money";
import { listPriceCents, promoDiscountCents } from "./pricing";

// Prices are read from the pricing module rather than typed in, so a price
// change does not need these tests edited — only `pricing.unit.test.ts`, which
// is where the published prices are actually asserted.
const PRO_MONTHLY = listPriceCents("pro", "monthly");
const PRO_ANNUAL = listPriceCents("pro", "annual");
const PREMIUM_MONTHLY = listPriceCents("premium", "monthly");

// The arithmetic behind a discount code, isolated from the database. These are
// the rules a client must never be able to influence: it sends a code, and
// these functions decide what it is worth.

describe("discountFor", () => {
  it("takes a percentage off", () => {
    expect(discountFor("percent", 50, 1900)).toBe(950);
    expect(discountFor("percent", 10, 1900)).toBe(190);
  });

  it("covers the whole price at 100%", () => {
    expect(discountFor("percent", 100, 1900)).toBe(1900);
    expect(discountFor("percent", 100, 3900)).toBe(3900);
  });

  it("treats a fixed value as whole currency units", () => {
    expect(discountFor("fixed", 5, 1900)).toBe(500);
    expect(discountFor("fixed", 19, 1900)).toBe(1900);
  });

  it("never discounts more than the price, so a total cannot go negative", () => {
    expect(discountFor("fixed", 99, 1900)).toBe(1900);
    expect(discountFor("percent", 500, 1900)).toBe(1900);
  });

  it("ignores negative values rather than adding to the price", () => {
    expect(discountFor("percent", -50, 1900)).toBe(0);
    expect(discountFor("fixed", -5, 1900)).toBe(0);
  });

  it("is 0 on a free plan", () => {
    expect(discountFor("percent", 100, 0)).toBe(0);
  });

  it("always returns whole minor units", () => {
    for (const value of [33, 7, 12.5, 99]) {
      expect(Number.isInteger(discountFor("percent", value, 1900))).toBe(true);
    }
  });
});

describe("normalizeCode", () => {
  it("uppercases and trims, so case never decides a discount", () => {
    expect(normalizeCode("  riff100 ")).toBe("RIFF100");
    expect(normalizeCode("RiFf-100")).toBe("RIFF-100");
  });
});

describe("promoPeriodEnd", () => {
  const from = new Date("2026-11-15T12:00:00.000Z");

  it("adds whole months", () => {
    expect(promoPeriodEnd(1, from)?.toISOString()).toBe("2026-12-15T12:00:00.000Z");
    expect(promoPeriodEnd(3, from)?.toISOString()).toBe("2027-02-15T12:00:00.000Z");
  });

  it("has no end date at 0 — a code that never lapses", () => {
    expect(promoPeriodEnd(0, from)).toBeNull();
    expect(promoPeriodEnd(-1, from)).toBeNull();
  });
});

describe("formatMoney", () => {
  it("prints a zero total in the deployment's own currency", () => {
    // Naira and dollars both read "0.00"; only the symbol differs, which is why
    // nothing hardcodes one.
    expect(formatMoney(0, "ngn")).toMatch(/0\.00$/);
    expect(formatMoney(0, "usd")).toBe("$0.00");
    expect(formatMoney(1900, "usd")).toBe("$19.00");
  });

  it("never throws on an unfamiliar currency code", () => {
    // Intl prints the code itself (with a non-breaking space) rather than
    // failing; the catch in formatMoney covers runtimes that do throw.
    expect(formatMoney(1900, "zzz").replace(/\u00a0/g, " ")).toBe("ZZZ 19.00");
  });
});

describe("evaluateCoupon", () => {
  const base: CouponRules = {
    code: "RIFF100",
    type: "percent",
    value: 100,
    description: "Launch team",
    active: true,
    expiresAt: null,
    maxRedemptions: 0,
    redeemed: 0,
    plans: "",
    durationMonths: 1,
  };
  const ctx = { plan: "pro" as const, alreadyRedeemed: false };

  it("takes a 100% code to zero and marks it free", () => {
    const res = evaluateCoupon(base, ctx);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.quote.originalCents).toBe(PRO_MONTHLY);
    expect(res.quote.discountCents).toBe(PRO_MONTHLY);
    expect(res.quote.finalCents).toBe(0);
    expect(res.quote.free).toBe(true);
  });

  it("leaves a partial discount payable, so it cannot be activated for nothing", () => {
    const res = evaluateCoupon({ ...base, value: 50 }, ctx);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // The *discount* is what gets rounded, so a half-cent lands in the
    // artist's favour: $29.99 less a rounded $15.00 is $14.99 payable.
    expect(res.quote.finalCents).toBe(PRO_MONTHLY - Math.round(PRO_MONTHLY / 2));
    expect(res.quote.free).toBe(false);
  });

  it("prices each plan from the server's own list price", () => {
    const pro = evaluateCoupon({ ...base, value: 10 }, ctx);
    const premium = evaluateCoupon({ ...base, value: 10 }, { ...ctx, plan: "premium" });
    expect(pro.ok && pro.quote.originalCents).toBe(PRO_MONTHLY);
    expect(premium.ok && premium.quote.originalCents).toBe(PREMIUM_MONTHLY);
  });

  it("refuses an unknown, inactive, expired or exhausted code", () => {
    const reason = (r: ReturnType<typeof evaluateCoupon>) => (r.ok ? null : r.reason);
    expect(reason(evaluateCoupon(null, ctx))).toBe("invalid");
    expect(reason(evaluateCoupon({ ...base, active: false }, ctx))).toBe("inactive");
    expect(reason(evaluateCoupon({ ...base, expiresAt: new Date("2020-01-01") }, ctx))).toBe("expired");
    expect(reason(evaluateCoupon({ ...base, maxRedemptions: 5, redeemed: 5 }, ctx))).toBe("exhausted");
  });

  it("refuses a code this artist has already redeemed", () => {
    const res = evaluateCoupon(base, { ...ctx, alreadyRedeemed: true });
    expect(res.ok ? null : res.reason).toBe("already_used");
  });

  it("honours plan scope, and treats an empty scope as every paid plan", () => {
    const proOnly = { ...base, plans: "pro" };
    expect(evaluateCoupon(proOnly, ctx).ok).toBe(true);
    const wrongPlan = evaluateCoupon(proOnly, { ...ctx, plan: "premium" });
    expect(wrongPlan.ok ? null : wrongPlan.reason).toBe("not_applicable");
    expect(evaluateCoupon(base, { ...ctx, plan: "premium" }).ok).toBe(true);
  });

  it("never lets a leaderboard reward code buy a subscription", () => {
    const res = evaluateCoupon({ ...base, type: "reward" }, ctx);
    expect(res.ok ? null : res.reason).toBe("not_a_discount");
  });

  it("expires exactly at the expiry instant, not a moment later", () => {
    const at = new Date("2026-11-15T12:00:00Z");
    const coupon = { ...base, expiresAt: at };
    expect(evaluateCoupon(coupon, { ...ctx, now: new Date(at.getTime() - 1) }).ok).toBe(true);
    expect(evaluateCoupon(coupon, { ...ctx, now: at }).ok).toBe(false);
  });
});

// ───────── Billing interval ─────────
// A code has to be quoted against the price the artist is actually buying.
// Quoting an annual purchase at the monthly price is how a 50%-off code ends
// up taking $15 off a $299.99 subscription.

describe("quoting a code against a billing interval", () => {
  const base: CouponRules = {
    code: "HALF",
    type: "percent",
    value: 50,
    description: "Half off",
    active: true,
    expiresAt: null,
    maxRedemptions: 0,
    redeemed: 0,
    plans: "",
    durationMonths: 1,
  };

  it("defaults to the monthly price when no interval is given", () => {
    const res = evaluateCoupon(base, { plan: "pro", alreadyRedeemed: false });
    expect(res.ok && res.quote.originalCents).toBe(PRO_MONTHLY);
    expect(res.ok && res.quote.interval).toBe("monthly");
  });

  it("prices an annual purchase from the annual price", () => {
    const res = evaluateCoupon(base, { plan: "pro", interval: "annual", alreadyRedeemed: false });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.quote.originalCents).toBe(PRO_ANNUAL);
    expect(res.quote.discountCents).toBe(Math.round(PRO_ANNUAL / 2));
    expect(res.quote.interval).toBe("annual");
  });

  it("still takes a 100% code to zero on either interval", () => {
    for (const interval of ["monthly", "annual"] as const) {
      const res = evaluateCoupon({ ...base, value: 100 }, { plan: "premium", interval, alreadyRedeemed: false });
      expect(res.ok && res.quote.finalCents).toBe(0);
      expect(res.ok && res.quote.free).toBe(true);
    }
  });

  it("exposes the list price, not the promotional price", () => {
    // Codes and the launch offer are alternatives, and checkout picks the
    // better one — which is only comparable from a common starting price.
    expect(planPriceCents("pro", "monthly")).toBe(PRO_MONTHLY);
    expect(planPriceCents("pro", "annual")).toBe(PRO_ANNUAL);
    expect(planPriceCents("free")).toBe(0);
  });
});

describe("accessMonthsFor", () => {
  const quote = (interval: "monthly" | "annual", durationMonths: number) =>
    ({ interval, durationMonths } as DiscountQuote);

  it("uses the code's own duration on a monthly plan", () => {
    expect(accessMonthsFor(quote("monthly", 1))).toBe(1);
    expect(accessMonthsFor(quote("monthly", 3))).toBe(3);
  });

  it("gives a free annual plan at least the year it covered", () => {
    // A one-month code that covered a whole $299.99 year must not hand over
    // one month of access.
    expect(accessMonthsFor(quote("annual", 1))).toBe(12);
    expect(accessMonthsFor(quote("annual", 18))).toBe(18);
  });

  it("keeps an unlimited code unlimited", () => {
    expect(accessMonthsFor(quote("annual", 0))).toBe(0);
    expect(accessMonthsFor(quote("monthly", 0))).toBe(0);
  });
});

// ───────── The BFCM launch offer ─────────

describe("campaignDiscount", () => {
  const DURING = new Date("2026-11-27T12:00:00.000Z");
  const AFTER = new Date("2026-12-10T12:00:00.000Z");

  it("offers nothing outside the campaign window", () => {
    expect(campaignDiscount("pro", "monthly", AFTER)).toBeNull();
    expect(campaignDiscount("premium", "annual", AFTER)).toBeNull();
  });

  it("prices the offer from the pricing module, to the cent", () => {
    const d = campaignDiscount("pro", "annual", DURING);
    expect(d).not.toBeNull();
    if (!d) return;
    expect(d.originalCents).toBe(PRO_ANNUAL);
    expect(d.discountCents).toBe(promoDiscountCents("pro", "annual"));
    // The figure Stripe is charged must equal the advertised price exactly.
    expect(d.finalCents).toBe(PRO_ANNUAL - promoDiscountCents("pro", "annual"));
    expect(d.percentOff).toBe(50);
  });

  it("says how long the offer price holds, per interval", () => {
    expect(campaignDiscount("pro", "annual", DURING)?.holdsFor).toBe("your first year");
    expect(campaignDiscount("pro", "monthly", DURING)?.holdsFor).toContain("months");
  });
});
