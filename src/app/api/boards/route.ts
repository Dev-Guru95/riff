import { z } from "zod";
import { getSession } from "@/lib/auth";
import { ok, fail, tooMany, withRoute, parseBody } from "@/lib/api";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { listBoardsForUser, createBoard } from "@/lib/boards";
import { BOARD_TEMPLATES } from "@/lib/board-templates";

// GET /api/boards — boards the current user belongs to.
export const GET = withRoute(async () => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const boards = await listBoardsForUser(session.id);
  return ok({ boards });
});

const KINDS = BOARD_TEMPLATES.map((t) => t.kind) as [string, ...string[]];
const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  kind: z.enum(KINDS).default("generic"),
});

// POST /api/boards — create a board from a template (creator becomes owner).
export const POST = withRoute(async (req: Request) => {
  const session = await getSession();
  if (!session) return fail("Not authenticated", 401);
  const rl = rateLimit(`board:create:${session.id}`, LIMITS.write.limit, LIMITS.write.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);
  const body = await parseBody(req, createSchema);
  if (body.error) return body.error;
  const id = await createBoard(session.id, body.data.title, body.data.kind);
  return ok({ id }, 201);
});
