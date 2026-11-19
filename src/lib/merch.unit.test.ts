import { describe, it, expect } from "vitest";
import {
  MERCH_STAGES,
  MERCH_TEMPLATES,
  catalogueTotals,
  priceEndingIn99,
  stageFor,
  suggestPriceCents,
  unitEconomics,
} from "./merch";

// The merch planner's arithmetic. These are the numbers an artist decides how
// much to spend from, so every one of them is checked.

const item = (cost: number, price: number, stock = 0, status = "idea") => ({ cost, price, stock, status });

describe("unitEconomics", () => {
  it("works out profit per unit and the margin on the sale", () => {
    const e = unitEconomics(item(1200, 3000));
    expect(e.marginCents).toBe(1800);
    expect(e.marginPct).toBe(60); // 1800/3000
    expect(e.markup).toBe(2.5);
  });

  it("values the stock on hand both ways", () => {
    const e = unitEconomics(item(1200, 3000, 25));
    expect(e.investedCents).toBe(30000); // 25 x $12 spent
    expect(e.potentialRevenueCents).toBe(75000); // 25 x $30
    expect(e.potentialProfitCents).toBe(45000);
  });

  it("says how many units clear the cost of the run", () => {
    // $300 spent, $18 profit per unit -> 17 sales (16.67 rounded up).
    expect(unitEconomics(item(1200, 3000, 25)).breakEvenUnits).toBe(17);
  });

  it("never reports a break-even that can never be reached", () => {
    // No margin means the run is never cleared; 0 rather than Infinity.
    expect(unitEconomics(item(3000, 3000, 10)).breakEvenUnits).toBe(0);
    expect(unitEconomics(item(3000, 1000, 10)).breakEvenUnits).toBe(0);
  });

  it("flags an item priced at or below cost as a loss", () => {
    expect(unitEconomics(item(3000, 2500)).health).toBe("loss");
    expect(unitEconomics(item(3000, 3000)).health).toBe("loss");
    expect(unitEconomics(item(3000, 2500)).marginCents).toBe(-500);
  });

  it("grades a margin against the 50% target", () => {
    expect(unitEconomics(item(1000, 1200)).health).toBe("thin"); // 17%
    expect(unitEconomics(item(1000, 1600)).health).toBe("ok"); // 38%
    expect(unitEconomics(item(1000, 2500)).health).toBe("strong"); // 60%
  });

  it("asks for a price before it says anything about margin", () => {
    const e = unitEconomics(item(1200, 0));
    expect(e.health).toBe("unpriced");
    expect(e.marginPct).toBe(0);
  });

  it("ignores negative figures rather than producing nonsense", () => {
    const e = unitEconomics(item(-500, -100, -5));
    expect(e.marginCents).toBe(0);
    expect(e.investedCents).toBe(0);
    expect(e.potentialRevenueCents).toBe(0);
  });
});

describe("suggestPriceCents", () => {
  it("prices to a 50% margin, ending in .99", () => {
    // $12 cost -> $24 for a 50% margin -> $23.99 is below, so round up.
    expect(suggestPriceCents(1200)).toBe(2499);
    expect(unitEconomics(item(1200, 2499)).marginPct).toBeGreaterThanOrEqual(50);
  });

  it("leaves a zero cost alone — a digital price is a judgement call", () => {
    expect(suggestPriceCents(0)).toBe(0);
  });

  it("always suggests a price above the cost", () => {
    for (const t of MERCH_TEMPLATES) {
      if (t.costCents > 0) expect(suggestPriceCents(t.costCents)).toBeGreaterThan(t.costCents);
    }
  });
});

describe("priceEndingIn99", () => {
  it("returns the smallest .99 price that is still at least the target", () => {
    expect(priceEndingIn99(2400)).toBe(2499);
    expect(priceEndingIn99(2450)).toBe(2499);
    expect(priceEndingIn99(2500)).toBe(2599);
    expect(priceEndingIn99(2501)).toBe(2599);
  });

  it("is idempotent on a price that already ends in .99", () => {
    expect(priceEndingIn99(2499)).toBe(2499);
  });

  it("never rounds below the target, which would undercut the margin", () => {
    for (let c = 200; c <= 10000; c += 7) {
      expect(priceEndingIn99(c)).toBeGreaterThanOrEqual(c);
    }
  });

  it("never returns a nonsense price", () => {
    expect(priceEndingIn99(1)).toBe(199);
    expect(priceEndingIn99(0)).toBe(199);
  });
});

describe("catalogueTotals", () => {
  it("rolls a catalogue up into the headline numbers", () => {
    const t = catalogueTotals([
      item(1200, 3000, 10, "for_sale"),
      item(2800, 7000, 5, "production"),
      item(300, 1500, 0, "idea"),
    ]);
    expect(t.items).toBe(3);
    expect(t.forSale).toBe(1);
    expect(t.investedCents).toBe(1200 * 10 + 2800 * 5);
    expect(t.potentialRevenueCents).toBe(3000 * 10 + 7000 * 5);
    expect(t.potentialProfitCents).toBe(1800 * 10 + 4200 * 5);
  });

  it("counts the items an artist needs to fix", () => {
    const t = catalogueTotals([item(3000, 2500, 1), item(1200, 3000, 1)]);
    expect(t.needsAttention).toBe(1);
  });

  it("averages the margin over priced items only", () => {
    // 60% and 60%, with an unpriced item that must not drag the average down.
    const t = catalogueTotals([item(1200, 3000), item(2800, 7000), item(500, 0)]);
    expect(t.avgMarginPct).toBe(60);
  });

  it("handles an empty catalogue", () => {
    const t = catalogueTotals([]);
    expect(t).toMatchObject({ items: 0, investedCents: 0, avgMarginPct: 0, needsAttention: 0 });
  });
});

describe("the pipeline", () => {
  it("gives every stage a meaning and a next step", () => {
    for (const s of MERCH_STAGES) {
      expect(s.meaning.length).toBeGreaterThan(10);
      expect(s.nextStep.length).toBeGreaterThan(10);
    }
  });

  it("falls back to the first stage for an unknown status", () => {
    expect(stageFor("nonsense").key).toBe("idea");
    expect(stageFor("for_sale").label).toBe("For sale");
  });
});

describe("the starter templates", () => {
  it("are all priced at a healthy margin", () => {
    for (const t of MERCH_TEMPLATES) {
      if (t.costCents === 0) continue; // digital: no cost to margin against
      const e = unitEconomics({ cost: t.costCents, price: t.priceCents, stock: 0 });
      expect(e.marginPct, `${t.name} margin`).toBeGreaterThanOrEqual(50);
    }
  });
});
