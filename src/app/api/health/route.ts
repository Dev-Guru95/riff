import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api";

// Liveness/readiness probe. Deliberately NOT wrapped in withRoute: the whole
// point is to *report* the failure rather than flatten it into a generic 500.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Human-readable cause for the Prisma error codes that actually take the app
 * down in production. The raw error text can embed the database host, so only
 * the code and this hint are returned to the caller; the full error is logged.
 */
function hintFor(code: string | undefined): string {
  switch (code) {
    case "P1000":
      return "Database rejected the credentials in DATABASE_URL.";
    case "P1001":
      return "Database is unreachable — it is suspended/deleted, or DATABASE_URL points at the wrong host.";
    case "P1002":
      return "Database host resolved but timed out.";
    case "P1003":
      return "The database named in DATABASE_URL does not exist.";
    case "P1017":
      return "Database closed the connection.";
    case "P2021":
      return "A table is missing — run `prisma migrate deploy`.";
    case "P2022":
      return "A column is missing — run `prisma migrate deploy`.";
    default:
      return "Database query failed. Check the service logs for the full error.";
  }
}

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return ok({ status: "ok", db: { ok: true, latencyMs: Date.now() - startedAt } });
  } catch (err) {
    console.error("[health] database check failed:", err);
    const code = (err as { code?: string }).code;
    return fail("Database unavailable", 503, {
      status: "degraded",
      db: { ok: false, code: code ?? null, hint: hintFor(code), latencyMs: Date.now() - startedAt },
    });
  }
}
