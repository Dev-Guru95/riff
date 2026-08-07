// Create (or promote) an admin user from environment variables.
//
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='…' pnpm exec tsx prisma/create-admin.ts
//
// Why this exists: prisma/seed.ts hardcodes admin@riff.app / admin12345, which is
// fine for a local SQLite file and unacceptable on a public URL. This script keeps
// the credential in the environment, so it never reaches git or a build log.
//
// It is idempotent and safe to leave in the build command: with either variable
// unset it prints a line and exits 0 without touching the database. Running it
// again with both set re-applies the password, which doubles as a password reset.
//
// Not imported from src/lib/auth.ts on purpose — that module imports next/headers,
// which cannot load outside a Next.js request context. BCRYPT_COST is mirrored
// here instead; keep the two in sync.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const BCRYPT_COST = 12; // must match BCRYPT_COST in src/lib/auth.ts
const MIN_PASSWORD_LENGTH = 12;

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.log("create-admin: ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping.");
    return;
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    // Throw rather than warn: a weak admin password on a public deployment is
    // exactly the failure this script was written to prevent.
    throw new Error(`create-admin: ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, role: "admin", status: "active" },
    });
    const note = existing.role === "admin" ? "password reset" : `promoted from "${existing.role}"`;
    console.log(`create-admin: updated ${email} (${note}).`);
    return;
  }

  // Mirror the relations POST /api/auth/signup creates, so an admin behaves like
  // any other account on pages that read profile/level/streak.
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "admin",
      profile: { create: { genres: JSON.stringify([]) } },
      level: { create: {} },
      streak: { create: {} },
    },
  });
  console.log(`create-admin: created admin ${email}.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
