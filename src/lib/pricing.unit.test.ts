import { describe, it, expect } from "vitest";
import {
  LIST_PRICE_CENTS,
  PROMO,
  PROMO_PRICE_CENTS,
  actualPercentOff,
  annualSavingCents,
  effectivePriceCents,
  isPromoActive,
  listPriceCents,
  monthsFreeOnAnnual,
  perMonthOnAnnualCents,
  priceView,
  promoDaysLeft,
  promoDiscountCents,
  promoHoldsFor,
  promoPriceCents,
  PAID_PLANS,
  BILLING_INTERVALS,
} from "./pricing";
import { formatMoney } from "./money";

// The published prices and every claim made about them. These tests exist so a
// future price edit that quietly breaks "2 months free", "50% off" or the
// Pro↔Premium relationship fails here instead of on the pricing page.

const DURING = new Date("2026-11-27T12:00:00.000Z"); // Black Friday 2026
const BEFORE = new Date("2026-11-01T12:00:00.000Z");
const AFTER = new Date("2026-12-10T12:00:00.000Z");

describe("published prices", () => {
  it("lists Pro at $29.99/mo and $299.99/yr", () => {
    expect(listPriceCents("pro", "monthly")).toBe(2999);
    expect(listPriceCents("pro", "annual")).toBe(29999);
    expect(formatMoney(listPriceCents("pro", "monthly"), "usd")).toBe("$29.99");
    expect(formatMoney(listPriceCents("pro", "annual"), "usd")).toBe("$299.99");
  });

  it("lists Premium at $59.99/mo and $599.99/yr", () => {
    expect(listPriceCents("premium", "monthly")).toBe(5999);
    expect(listPriceCents("premium", "annual")).toBe(59999);
  });

  it("keeps the Pro↔Premium relationship that existed before the price rise", () => {
    // Premium used to be $39 against Pro's $19 — 2.05x. The new prices hold
    // that multiple to within a rounding of a credible price point.
    const oldRatio = 39 / 19;
    for (const interval of BILLING_INTERVALS) {
      const ratio = listPriceCents("premium", interval) / listPriceCents("pro", interval);
      expect(Math.abs(ratio - oldRatio)).toBeLessThan(0.1);
    }
  });

  it("prices annual at ten monthly charges, so two months are free", () => {
    for (const plan of PAID_PLANS) {
      const monthly = listPriceCents(plan, "monthly");
      // 10 x monthly, allowing the one cent of .99 rounding.
      expect(Math.abs(listPriceCents(plan, "annual") - monthly * 10)).toBeLessThanOrEqual(10);
      expect(monthsFreeOnAnnual(plan)).toBe(2);
    }
  });

  it("every price is a whole number of cents", () => {
    for (const plan of PAID_PLANS) {
      for (const interval of BILLING_INTERVALS) {
        expect(Number.isInteger(LIST_PRICE_CENTS[plan][interval])).toBe(true);
        expect(Number.isInteger(PROMO_PRICE_CENTS[plan][interval])).toBe(true);
      }
    }
  });
});

describe("the BFCM launch offer", () => {
  it("halves every price", () => {
    expect(promoPriceCents("pro", "monthly")).toBe(1499);
    expect(promoPriceCents("pro", "annual")).toBe(14999);
    expect(promoPriceCents("premium", "monthly")).toBe(2999);
    expect(promoPriceCents("premium", "annual")).toBe(29999);
  });

  it("is a true 50% off on every plan and interval", () => {
    for (const plan of PAID_PLANS) {
      for (const interval of BILLING_INTERVALS) {
        expect(actualPercentOff(plan, interval)).toBe(PROMO.percentOff);
      }
    }
  });

  it("derives the discount from the two prices, so the charge matches the advert", () => {
    // This is the number handed to Stripe as a fixed amount_off. A percentage
    // coupon would charge $15.00 against an advertised $14.99.
    expect(promoDiscountCents("pro", "monthly")).toBe(2999 - 1499);
    expect(promoDiscountCents("pro", "annual")).toBe(29999 - 14999);
    for (const plan of PAID_PLANS) {
      for (const interval of BILLING_INTERVALS) {
        expect(listPriceCents(plan, interval) - promoDiscountCents(plan, interval)).toBe(
          promoPriceCents(plan, interval),
        );
      }
    }
  });

  it("still gives two free months on the discounted annual price", () => {
    for (const plan of PAID_PLANS) {
      expect(monthsFreeOnAnnual(plan, true)).toBe(2);
    }
  });

  it("runs only inside its window", () => {
    expect(isPromoActive(BEFORE)).toBe(false);
    expect(isPromoActive(DURING)).toBe(true);
    expect(isPromoActive(AFTER)).toBe(false);
  });

  it("charges the promotional price during the window and the list price outside it", () => {
    expect(effectivePriceCents("pro", "monthly", DURING)).toBe(1499);
    expect(effectivePriceCents("pro", "monthly", AFTER)).toBe(2999);
    expect(effectivePriceCents("premium", "annual", DURING)).toBe(29999);
    expect(effectivePriceCents("premium", "annual", AFTER)).toBe(59999);
  });

  it("counts down to the close and stops at zero", () => {
    expect(promoDaysLeft(DURING)).toBeGreaterThan(0);
    expect(promoDaysLeft(AFTER)).toBe(0);
  });

  it("says how long the offer price holds", () => {
    expect(promoHoldsFor("annual")).toBe("your first year");
    expect(promoHoldsFor("monthly")).toContain(String(PROMO.monthlyDurationMonths));
  });
});

describe("annual savings", () => {
  it("is the difference against twelve monthly charges", () => {
    expect(annualSavingCents("pro")).toBe(2999 * 12 - 29999); // $59.89
    expect(annualSavingCents("premium")).toBe(5999 * 12 - 59999); // $119.89
    expect(annualSavingCents("pro", true)).toBe(1499 * 12 - 14999);
  });

  it("expresses an annual price per month", () => {
    expect(perMonthOnAnnualCents(29999)).toBe(2500); // $25.00/mo
    expect(perMonthOnAnnualCents(14999)).toBe(1250); // $12.50/mo on the offer
  });
});

describe("priceView", () => {
  it("resolves everything the pricing card renders, during the offer", () => {
    const v = priceView("pro", "annual", DURING);
    expect(v).toMatchObject({
      plan: "pro",
      interval: "annual",
      listCents: 29999,
      payCents: 14999,
      discountCents: 15000,
      promo: true,
      percentOff: 50,
      perMonthCents: 1250,
      monthsFree: 2,
      thenCents: 29999,
    });
  });

  it("shows no discount and nothing struck through outside the offer", () => {
    const v = priceView("premium", "monthly", AFTER);
    expect(v.promo).toBe(false);
    expect(v.payCents).toBe(v.listCents);
    expect(v.discountCents).toBe(0);
    expect(v.percentOff).toBe(0);
    expect(v.thenCents).toBeNull();
  });

  it("reports a monthly price as its own per-month figure", () => {
    const v = priceView("pro", "monthly", AFTER);
    expect(v.perMonthCents).toBe(v.payCents);
  });
});
