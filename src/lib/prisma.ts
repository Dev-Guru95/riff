import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Case-insensitive "contains" filter for user-facing search.
 *
 * Postgres `LIKE` is case-sensitive, so a bare `{ contains: term }` would only
 * match exact casing. `mode: "insensitive"` compiles to `ILIKE`. Use this
 * anywhere a human types the search term.
 */
export const ci = (term: string) => ({ contains: term, mode: "insensitive" as const });
