// Studio "personal manager" tools (Wave 3a): Brand Kit, Revenue & Budget
// Tracker, and Merch & Gig Planner. All strictly per-user (owner-scoped).
import { prisma } from "@/lib/prisma";

function safeArr<T>(json: string): T[] {
  try { const v = JSON.parse(json); return Array.isArray(v) ? v : []; } catch { return []; }
}

// ---- Brand Kit (Track 1) ---------------------------------------------------
export type BrandColor = { name: string; hex: string };
export type BrandFont = { name: string; usage: string };
export type BrandKitDTO = {
  colors: BrandColor[];
  fonts: BrandFont[];
  guidelines: string;
  assets: { id: string; name: string; url: string }[];
};

export async function getBrandKit(userId: string): Promise<BrandKitDTO> {
  const kit = await prisma.brandKit.upsert({
    where: { userId },
    create: { userId },
    update: {},
    include: { assets: { orderBy: { createdAt: "asc" } } },
  });
  return {
    colors: safeArr<BrandColor>(kit.colors),
    fonts: safeArr<BrandFont>(kit.fonts),
    guidelines: kit.guidelines,
    assets: kit.assets.map((a) => ({ id: a.id, name: a.name, url: a.url })),
  };
}

export async function updateBrandKit(
  userId: string,
  data: { colors?: BrandColor[]; fonts?: BrandFont[]; guidelines?: string },
): Promise<void> {
  const patch: Record<string, string> = {};
  if (data.colors) patch.colors = JSON.stringify(data.colors.slice(0, 24));
  if (data.fonts) patch.fonts = JSON.stringify(data.fonts.slice(0, 12));
  if (data.guidelines !== undefined) patch.guidelines = data.guidelines;
  await prisma.brandKit.upsert({ where: { userId }, create: { userId, ...patch }, update: patch });
}

export async function addBrandAsset(userId: string, name: string, url: string): Promise<string> {
  const kit = await prisma.brandKit.upsert({ where: { userId }, create: { userId }, update: {} });
  const a = await prisma.brandAsset.create({ data: { brandKitId: kit.id, name, url } });
  return a.id;
}

export async function deleteBrandAsset(userId: string, id: string): Promise<boolean> {
  const a = await prisma.brandAsset.findUnique({ where: { id }, select: { brandKit: { select: { userId: true } } } });
  if (!a || a.brandKit.userId !== userId) return false;
  await prisma.brandAsset.delete({ where: { id } });
  return true;
}

// ---- Revenue & Budget Tracker (Track 6) ------------------------------------
export type FinanceEntryDTO = {
  id: string; kind: string; category: string; label: string; amount: number; currency: string; date: string;
};
export type FinanceDTO = {
  entries: FinanceEntryDTO[];
  totals: { income: number; expense: number; net: number };
  byCategory: { category: string; net: number }[];
};

export async function listFinance(userId: string): Promise<FinanceDTO> {
  const rows = await prisma.financeEntry.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 500 });
  let income = 0, expense = 0;
  const cat = new Map<string, number>();
  for (const r of rows) {
    if (r.kind === "income") income += r.amount; else expense += r.amount;
    const k = r.category || "other";
    cat.set(k, (cat.get(k) ?? 0) + (r.kind === "income" ? r.amount : -r.amount));
  }
  return {
    entries: rows.map((r) => ({ id: r.id, kind: r.kind, category: r.category, label: r.label, amount: r.amount, currency: r.currency, date: r.date.toISOString() })),
    totals: { income, expense, net: income - expense },
    byCategory: [...cat.entries()].map(([category, net]) => ({ category, net })).sort((a, b) => b.net - a.net),
  };
}

export async function addFinance(
  userId: string,
  d: { kind: string; category: string; label: string; amount: number; date?: string | null },
): Promise<string> {
  const e = await prisma.financeEntry.create({
    data: { userId, kind: d.kind, category: d.category, label: d.label, amount: d.amount, date: d.date ? new Date(d.date) : new Date() },
  });
  return e.id;
}

export async function deleteFinance(userId: string, id: string): Promise<boolean> {
  const e = await prisma.financeEntry.findUnique({ where: { id }, select: { userId: true } });
  if (!e || e.userId !== userId) return false;
  await prisma.financeEntry.delete({ where: { id } });
  return true;
}

// ---- Merch & Gig Planner (Track 6) -----------------------------------------
export type MerchDTO = { id: string; name: string; status: string; cost: number; price: number; stock: number; notes: string };
export type GigDTO = { id: string; venue: string; city: string; date: string | null; status: string; fee: number; notes: string };

export async function listMerchAndGigs(userId: string): Promise<{ merch: MerchDTO[]; gigs: GigDTO[] }> {
  const [merch, gigs] = await Promise.all([
    prisma.merchItem.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.gig.findMany({ where: { userId }, orderBy: [{ date: "asc" }, { createdAt: "desc" }] }),
  ]);
  return {
    merch: merch.map((m) => ({ id: m.id, name: m.name, status: m.status, cost: m.cost, price: m.price, stock: m.stock, notes: m.notes })),
    gigs: gigs.map((g) => ({ id: g.id, venue: g.venue, city: g.city, date: g.date?.toISOString() ?? null, status: g.status, fee: g.fee, notes: g.notes })),
  };
}

export async function addMerch(
  userId: string,
  name: string,
  // Optional starting figures. Used when an item is created from a template or
  // from an AI concept, so the first thing the artist sees is a real margin
  // rather than an empty row they have to fill in before the screen means
  // anything.
  seed?: { cost?: number; price?: number; stock?: number; notes?: string; status?: string },
): Promise<string> {
  const m = await prisma.merchItem.create({
    data: {
      userId,
      name,
      ...(seed?.cost !== undefined ? { cost: Math.max(0, Math.round(seed.cost)) } : {}),
      ...(seed?.price !== undefined ? { price: Math.max(0, Math.round(seed.price)) } : {}),
      ...(seed?.stock !== undefined ? { stock: Math.max(0, Math.round(seed.stock)) } : {}),
      ...(seed?.notes !== undefined ? { notes: seed.notes.slice(0, 2000) } : {}),
      ...(seed?.status !== undefined ? { status: seed.status } : {}),
    },
  });
  return m.id;
}

export type MerchSaleResult = {
  item: MerchDTO;
  /** Units actually recorded (never more than the stock on hand). */
  units: number;
  /** Revenue written to the finance ledger, in cents. */
  revenueCents: number;
  /** Profit on those units, in cents. */
  profitCents: number;
  financeEntryId: string;
};

/**
 * Record merch sales: take the units off the shelf and put the money in the
 * ledger.
 *
 * This is the join between the two Studio tools that were previously unaware
 * of each other — an artist tracked merch in one screen and typed the income
 * into another by hand, or more often never did, so Revenue was always wrong.
 *
 * Only the *income* is written. The cost of the run was spent when it was
 * ordered, and is logged once by {@link recordMerchRunCost}; writing it again
 * per sale would double-count it and understate profit.
 */
export async function recordMerchSale(
  userId: string,
  id: string,
  units: number,
): Promise<MerchSaleResult | { error: "not_found" | "no_stock" | "unpriced" }> {
  const item = await prisma.merchItem.findUnique({ where: { id } });
  if (!item || item.userId !== userId) return { error: "not_found" };
  if (item.price <= 0) return { error: "unpriced" };
  if (item.stock <= 0) return { error: "no_stock" };

  const sold = Math.max(1, Math.min(Math.round(units), item.stock));
  const revenueCents = item.price * sold;
  const profitCents = (item.price - item.cost) * sold;
  const remaining = item.stock - sold;

  const [updated, entry] = await prisma.$transaction([
    prisma.merchItem.update({
      where: { id },
      data: {
        stock: remaining,
        // Selling the last unit is what "sold out" means — don't make the
        // artist remember to change the dropdown too.
        ...(remaining === 0 && item.status === "for_sale" ? { status: "sold_out" } : {}),
      },
    }),
    prisma.financeEntry.create({
      data: {
        userId,
        kind: "income",
        category: "merch",
        label: `${sold} x ${item.name}`,
        amount: revenueCents,
      },
    }),
  ]);

  return {
    item: { id: updated.id, name: updated.name, status: updated.status, cost: updated.cost, price: updated.price, stock: updated.stock, notes: updated.notes },
    units: sold,
    revenueCents,
    profitCents,
    financeEntryId: entry.id,
  };
}

/**
 * Log what a production run cost as an expense, once.
 *
 * Idempotent by label: ordering the same run twice is a mistake, not two
 * expenses, so a second call for an unchanged run updates the existing entry
 * instead of inflating costs.
 */
export async function recordMerchRunCost(
  userId: string,
  id: string,
  units: number,
): Promise<{ expenseCents: number; units: number; financeEntryId: string } | { error: "not_found" | "no_cost" }> {
  const item = await prisma.merchItem.findUnique({ where: { id } });
  if (!item || item.userId !== userId) return { error: "not_found" };
  if (item.cost <= 0) return { error: "no_cost" };

  const qty = Math.max(1, Math.round(units));
  const expenseCents = item.cost * qty;
  const label = `Run: ${qty} x ${item.name}`;

  const existing = await prisma.financeEntry.findFirst({
    where: { userId, kind: "expense", category: "merch", label },
  });
  const entry = existing
    ? await prisma.financeEntry.update({ where: { id: existing.id }, data: { amount: expenseCents } })
    : await prisma.financeEntry.create({
        data: { userId, kind: "expense", category: "merch", label, amount: expenseCents },
      });

  return { expenseCents, units: qty, financeEntryId: entry.id };
}
export async function updateMerch(userId: string, id: string, data: Partial<Omit<MerchDTO, "id">>): Promise<boolean> {
  const m = await prisma.merchItem.findUnique({ where: { id }, select: { userId: true } });
  if (!m || m.userId !== userId) return false;
  await prisma.merchItem.update({ where: { id }, data });
  return true;
}
export async function deleteMerch(userId: string, id: string): Promise<boolean> {
  const m = await prisma.merchItem.findUnique({ where: { id }, select: { userId: true } });
  if (!m || m.userId !== userId) return false;
  await prisma.merchItem.delete({ where: { id } });
  return true;
}

export async function addGig(userId: string, venue: string): Promise<string> {
  const g = await prisma.gig.create({ data: { userId, venue } });
  return g.id;
}
export async function updateGig(
  userId: string,
  id: string,
  data: { venue?: string; city?: string; date?: string | null; status?: string; fee?: number; notes?: string },
): Promise<boolean> {
  const g = await prisma.gig.findUnique({ where: { id }, select: { userId: true } });
  if (!g || g.userId !== userId) return false;
  const patch: Record<string, unknown> = { ...data };
  if (data.date !== undefined) patch.date = data.date ? new Date(data.date) : null;
  await prisma.gig.update({ where: { id }, data: patch });
  return true;
}
export async function deleteGig(userId: string, id: string): Promise<boolean> {
  const g = await prisma.gig.findUnique({ where: { id }, select: { userId: true } });
  if (!g || g.userId !== userId) return false;
  await prisma.gig.delete({ where: { id } });
  return true;
}
