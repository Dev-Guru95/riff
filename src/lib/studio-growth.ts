// Studio tools: Goal & Milestone Tracker, Fan CRM + Segmentation, Broadcasts,
// Bookings, and the Link-in-Bio page. All per-user (owner-scoped).
import { prisma } from "@/lib/prisma";

function arr<T>(json: string): T[] {
  try { const v = JSON.parse(json); return Array.isArray(v) ? v : []; } catch { return []; }
}

// ---- Goal & Milestone Tracker (Track 8) ------------------------------------
export type Milestone = { text: string; done: boolean };
export type GoalDTO = {
  id: string; title: string; detail: string; targetDate: string | null;
  progress: number; milestones: Milestone[]; status: string;
};
const toGoal = (g: { id: string; title: string; detail: string; targetDate: Date | null; progress: number; milestones: string; status: string }): GoalDTO => ({
  id: g.id, title: g.title, detail: g.detail, targetDate: g.targetDate?.toISOString() ?? null,
  progress: g.progress, milestones: arr<Milestone>(g.milestones), status: g.status,
});

export async function listGoals(userId: string): Promise<GoalDTO[]> {
  const rows = await prisma.careerGoal.findMany({ where: { userId }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] });
  return rows.map(toGoal);
}
export async function addGoal(userId: string, title: string): Promise<string> {
  const g = await prisma.careerGoal.create({ data: { userId, title } });
  return g.id;
}
export async function updateGoal(
  userId: string, id: string,
  data: { title?: string; detail?: string; targetDate?: string | null; progress?: number; milestones?: Milestone[]; status?: string },
): Promise<boolean> {
  const g = await prisma.careerGoal.findUnique({ where: { id }, select: { userId: true } });
  if (!g || g.userId !== userId) return false;
  const patch: Record<string, unknown> = {};
  if (data.title !== undefined) patch.title = data.title;
  if (data.detail !== undefined) patch.detail = data.detail;
  if (data.targetDate !== undefined) patch.targetDate = data.targetDate ? new Date(data.targetDate) : null;
  if (data.progress !== undefined) patch.progress = Math.max(0, Math.min(100, data.progress));
  if (data.milestones !== undefined) patch.milestones = JSON.stringify(data.milestones.slice(0, 50));
  if (data.status !== undefined) patch.status = data.status;
  await prisma.careerGoal.update({ where: { id }, data: patch });
  return true;
}
export async function deleteGoal(userId: string, id: string): Promise<boolean> {
  const g = await prisma.careerGoal.findUnique({ where: { id }, select: { userId: true } });
  if (!g || g.userId !== userId) return false;
  await prisma.careerGoal.delete({ where: { id } });
  return true;
}

// ---- Fan CRM + Segmentation (Track 5) --------------------------------------
export type FanDTO = { id: string; name: string; email: string; location: string; tags: string[]; source: string; notes: string };
const toFan = (f: { id: string; name: string; email: string; location: string; tags: string; source: string; notes: string }): FanDTO => ({
  id: f.id, name: f.name, email: f.email, location: f.location, tags: arr<string>(f.tags), source: f.source, notes: f.notes,
});

export async function listFans(userId: string, tag?: string): Promise<{ fans: FanDTO[]; segments: { tag: string; count: number }[]; total: number }> {
  const rows = await prisma.fan.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 1000 });
  const all = rows.map(toFan);
  const seg = new Map<string, number>();
  for (const f of all) for (const t of f.tags) seg.set(t, (seg.get(t) ?? 0) + 1);
  const fans = tag ? all.filter((f) => f.tags.includes(tag)) : all;
  return { fans, segments: [...seg.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count), total: all.length };
}
export async function addFan(userId: string, d: { name: string; email?: string; source?: string; tags?: string[] }): Promise<string> {
  const f = await prisma.fan.create({ data: { userId, name: d.name, email: d.email ?? "", source: d.source ?? "", tags: JSON.stringify(d.tags ?? []) } });
  return f.id;
}
export async function updateFan(
  userId: string, id: string,
  d: { name?: string; email?: string; location?: string; tags?: string[]; source?: string; notes?: string },
): Promise<boolean> {
  const f = await prisma.fan.findUnique({ where: { id }, select: { userId: true } });
  if (!f || f.userId !== userId) return false;
  const patch: Record<string, unknown> = { ...d };
  if (d.tags !== undefined) patch.tags = JSON.stringify(d.tags.slice(0, 30));
  await prisma.fan.update({ where: { id }, data: patch });
  return true;
}
export async function deleteFan(userId: string, id: string): Promise<boolean> {
  const f = await prisma.fan.findUnique({ where: { id }, select: { userId: true } });
  if (!f || f.userId !== userId) return false;
  await prisma.fan.delete({ where: { id } });
  return true;
}

// ---- Broadcasts (Track 5) --------------------------------------------------
export type BroadcastDTO = { id: string; subject: string; body: string; segment: string; recipientCount: number; sentAt: string | null };
const toBroadcast = (b: { id: string; subject: string; body: string; segment: string; recipientCount: number; sentAt: Date | null }): BroadcastDTO => ({
  id: b.id, subject: b.subject, body: b.body, segment: b.segment, recipientCount: b.recipientCount, sentAt: b.sentAt?.toISOString() ?? null,
});

export async function listBroadcasts(userId: string): Promise<BroadcastDTO[]> {
  const rows = await prisma.broadcast.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  return rows.map(toBroadcast);
}
export async function addBroadcast(userId: string, subject: string): Promise<string> {
  const b = await prisma.broadcast.create({ data: { userId, subject } });
  return b.id;
}
export async function updateBroadcast(userId: string, id: string, d: { subject?: string; body?: string; segment?: string }): Promise<boolean> {
  const b = await prisma.broadcast.findUnique({ where: { id }, select: { userId: true, sentAt: true } });
  if (!b || b.userId !== userId || b.sentAt) return false; // can't edit after "send"
  await prisma.broadcast.update({ where: { id }, data: d });
  return true;
}
/** "Sends" a broadcast: records sentAt + the matching-fan count. Actual email
 *  delivery requires an email provider (not configured) — this records the send. */
export async function sendBroadcast(userId: string, id: string): Promise<number | null> {
  const b = await prisma.broadcast.findUnique({ where: { id } });
  if (!b || b.userId !== userId || b.sentAt) return null;
  // Count fans-with-email in the segment using the SAME exact tag match as
  // listFans (case-sensitive Array.includes), so the recorded recipientCount
  // agrees with the segment size the user saw.
  const fans = await prisma.fan.findMany({ where: { userId, email: { not: "" } }, select: { tags: true } });
  const count = b.segment ? fans.filter((f) => arr<string>(f.tags).includes(b.segment)).length : fans.length;
  // Atomic double-send guard: only stamp if still unsent.
  const res = await prisma.broadcast.updateMany({ where: { id, userId, sentAt: null }, data: { sentAt: new Date(), recipientCount: count } });
  if (res.count === 0) return null; // concurrent send won the race
  return count;
}
export async function deleteBroadcast(userId: string, id: string): Promise<boolean> {
  const b = await prisma.broadcast.findUnique({ where: { id }, select: { userId: true } });
  if (!b || b.userId !== userId) return false;
  await prisma.broadcast.delete({ where: { id } });
  return true;
}

// ---- Booking Scheduler (Track 7) -------------------------------------------
export type BookingDTO = { id: string; title: string; contact: string; date: string | null; status: string; fee: number; notes: string };
const toBooking = (b: { id: string; title: string; contact: string; date: Date | null; status: string; fee: number; notes: string }): BookingDTO => ({
  id: b.id, title: b.title, contact: b.contact, date: b.date?.toISOString() ?? null, status: b.status, fee: b.fee, notes: b.notes,
});

export async function listBookings(userId: string): Promise<BookingDTO[]> {
  const rows = await prisma.booking.findMany({ where: { userId }, orderBy: [{ date: "asc" }, { createdAt: "desc" }] });
  return rows.map(toBooking);
}
export async function addBooking(userId: string, title: string): Promise<string> {
  const b = await prisma.booking.create({ data: { userId, title } });
  return b.id;
}
export async function updateBooking(
  userId: string, id: string,
  d: { title?: string; contact?: string; date?: string | null; status?: string; fee?: number; notes?: string },
): Promise<boolean> {
  const b = await prisma.booking.findUnique({ where: { id }, select: { userId: true } });
  if (!b || b.userId !== userId) return false;
  const patch: Record<string, unknown> = { ...d };
  if (d.date !== undefined) patch.date = d.date ? new Date(d.date) : null;
  await prisma.booking.update({ where: { id }, data: patch });
  return true;
}
export async function deleteBooking(userId: string, id: string): Promise<boolean> {
  const b = await prisma.booking.findUnique({ where: { id }, select: { userId: true } });
  if (!b || b.userId !== userId) return false;
  await prisma.booking.delete({ where: { id } });
  return true;
}

// ---- Link-in-Bio (Track 5) -------------------------------------------------
export type LinkItem = { label: string; url: string };
export type LinkPageDTO = { handle: string; title: string; bio: string; theme: string; links: LinkItem[]; published: boolean };

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "artist";
}

type LinkPageRow = { handle: string; title: string; bio: string; theme: string; links: string; published: boolean };
const toLinkPage = (p: LinkPageRow): LinkPageDTO => ({ handle: p.handle, title: p.title, bio: p.bio, theme: p.theme, links: arr<LinkItem>(p.links), published: p.published });

// Drop dangerous URL schemes at the storage boundary (defense-in-depth; the
// public render also coerces to https via safe()).
function cleanLinks(links: LinkItem[]): LinkItem[] {
  return links.filter((l) => l.url && !/^\s*(javascript|data|vbscript):/i.test(l.url)).slice(0, 30);
}

export async function getLinkPage(userId: string): Promise<LinkPageDTO> {
  const existing = await prisma.linkPage.findUnique({ where: { userId } });
  if (existing) return toLinkPage(existing);

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, profile: { select: { stageName: true } } } });
  const base = slugify(user?.profile?.stageName || user?.email.split("@")[0] || "artist");
  const title = user?.profile?.stageName || "My Links";
  // Try base, base-2, … handling collisions atomically. A userId collision means
  // a concurrent request already created this user's page → read and return it.
  for (let attempt = 0; attempt < 8; attempt++) {
    const handle = attempt === 0 ? base : `${base}-${attempt + 1}`;
    try {
      return toLinkPage(await prisma.linkPage.create({ data: { userId, handle, title } }));
    } catch {
      const now = await prisma.linkPage.findUnique({ where: { userId } });
      if (now) return toLinkPage(now); // someone created it for this user
      // else the handle was taken — try the next suffix
    }
  }
  // Extremely unlikely fallback: a guaranteed-unique handle from the userId.
  return toLinkPage(await prisma.linkPage.create({ data: { userId, handle: `${base}-${userId.slice(-6)}`, title } }));
}

export async function updateLinkPage(
  userId: string,
  d: { handle?: string; title?: string; bio?: string; theme?: string; links?: LinkItem[]; published?: boolean },
): Promise<{ ok: true; page: LinkPageDTO } | { ok: false; error: string }> {
  await getLinkPage(userId); // ensure exists
  const patch: Record<string, unknown> = {};
  if (d.handle !== undefined) {
    const handle = slugify(d.handle);
    const taken = await prisma.linkPage.findUnique({ where: { handle }, select: { userId: true } });
    if (taken && taken.userId !== userId) return { ok: false, error: "That handle is taken" };
    patch.handle = handle;
  }
  if (d.title !== undefined) patch.title = d.title;
  if (d.bio !== undefined) patch.bio = d.bio;
  if (d.theme !== undefined) patch.theme = d.theme;
  if (d.links !== undefined) patch.links = JSON.stringify(cleanLinks(d.links));
  if (d.published !== undefined) patch.published = d.published;
  try {
    const page = await prisma.linkPage.update({ where: { userId }, data: patch });
    return { ok: true, page: toLinkPage(page) };
  } catch {
    // Unique-constraint race on handle → clean 422 instead of a 500.
    return { ok: false, error: "That handle is taken" };
  }
}

/** Public read of a published link page by handle (unauthenticated). */
export async function getPublicLinkPage(handle: string): Promise<LinkPageDTO | null> {
  const page = await prisma.linkPage.findUnique({ where: { handle } });
  if (!page || !page.published) return null;
  return { handle: page.handle, title: page.title, bio: page.bio, theme: page.theme, links: arr<LinkItem>(page.links), published: page.published };
}
