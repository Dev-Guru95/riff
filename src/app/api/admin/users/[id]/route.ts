import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, writeAudit } from "@/lib/admin";
import { markSkoolMember, revokeSkoolMember } from "@/lib/community";
import { parseBody, ok, fail } from "@/lib/api";

const schema = z.object({
  status: z.enum(["active", "suspended"]).optional(),
  role: z.enum(["artist", "admin", "reviewer", "moderator"]).optional(),
  skoolMember: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAdmin("admin");
  if (error) return error;
  const { id } = await params;
  const body = await parseBody(req, schema);
  if (body.error) return body.error;

  if (id === session.id && body.data.status === "suspended") {
    return fail("You cannot suspend your own account", 400);
  }
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return fail("User not found", 404);

  // Membership goes through the community service so joinedAt + notify stay consistent.
  const { skoolMember, ...rest } = body.data;
  if (skoolMember !== undefined) {
    if (skoolMember) await markSkoolMember(id, { source: "admin" });
    else await revokeSkoolMember(id);
  }
  const updated =
    Object.keys(rest).length > 0
      ? await prisma.user.update({ where: { id }, data: rest })
      : await prisma.user.findUniqueOrThrow({ where: { id } });
  await writeAudit(session.id, "user.update", "user", id, body.data);
  return ok({ id: updated.id, status: updated.status, role: updated.role, skoolMember: updated.skoolMember });
}
