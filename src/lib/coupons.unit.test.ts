import { describe, it, expect } from "vitest";
import { discountFor, evaluateCoupon, normalizeCode, promoPeriodEnd, type CouponRules } from "./coupons";
import { formatMoney } from "./money";

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
    expect(res.quote.originalCents).toBe(1900);
    expect(res.quote.discountCents).toBe(1900);
    expect(res.quote.finalCents).toBe(0);
    expect(res.quote.free).toBe(true);
  });

  it("leaves a partial discount payable, so it cannot be activated for nothing", () => {
    const res = evaluateCoupon({ ...base, value: 50 }, ctx);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.quote.finalCents).toBe(950);
    expect(res.quote.free).toBe(false);
  });

  it("prices each plan from the server's own list price", () => {
    const pro = evaluateCoupon({ ...base, value: 10 }, ctx);
    const premium = evaluateCoupon({ ...base, value: 10 }, { ...ctx, plan: "premium" });
    expect(pro.ok && pro.quote.originalCents).toBe(1900);
    expect(premium.ok && premium.quote.originalCents).toBe(3900);
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
