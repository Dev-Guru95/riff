import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ok, fail, withRoute } from "@/lib/api";

// List recent notifications + unread count.
export const GET = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: session.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.notification.count({ where: { userId: session.id, read: false } }),
  ]);
  return ok({ items, unread });
});

// Mark all (or a specific id) as read.
export const POST = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  let id: string | undefined;
  try {
    id = (await req.json())?.id;
  } catch {
    /* mark all */
  }
  await prisma.notification.updateMany({
    where: { userId: session.id, ...(id ? { id } : {}), read: false },
    data: { read: true },
  });
  return ok({ success: true });
});
