// Reports what is actually in the database, and can wipe it on request.
//
//   pnpm exec tsx prisma/db-doctor.ts
//
// Why this exists: on Render's free tier there is no Shell and no One-Off Jobs,
// so the build log is the only way to see inside the deployed database. This
// runs as a build step and prints the real schema state next to the schema the
// app expects, which is what turns a "column does not exist" 500 into a
// diagnosis.
//
// It is read-only unless DB_RESET is set to the exact confirmation phrase, in
// which case it drops and recreates the `public` schema. The step that follows
// it in the build command (`prisma migrate deploy`) then rebuilds every table
// from the migrations. Set DB_RESET, deploy once, then CLEAR IT — leaving it
// set wipes the database on every single deploy.

import { PrismaClient } from "@prisma/client";

const RESET_PHRASE = "wipe-and-rebuild";
const prisma = new PrismaClient();

// Tables the app cannot serve a single signed-in page without. Checked by name
// so a partially-applied or foreign schema is reported precisely rather than as
// a generic mismatch.
const CORE_TABLES = [
  "User",
  "ArtistProfile",
  "Course",
  "Module",
  "Lesson",
  "Enrollment",
  "LessonProgress",
  "Badge",
  "UserBadge",
  "UserLevel",
  "Streak",
  "XpLedger",
  "Certificate",
];

async function listTables(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  return rows.map((r) => r.table_name);
}

async function listMigrations(): Promise<{ name: string; finished: boolean }[]> {
  try {
    const rows = await prisma.$queryRaw<{ migration_name: string; finished_at: Date | null }[]>`
      SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at
    `;
    return rows.map((r) => ({ name: r.migration_name, finished: r.finished_at !== null }));
  } catch {
    return []; // table absent — Prisma has never migrated this database
  }
}

async function main() {
  console.log("\n=== db-doctor ===");

  const tables = await listTables();
  const migrations = await listMigrations();
  const missing = CORE_TABLES.filter((t) => !tables.includes(t));

  console.log(`Tables in public schema: ${tables.length}`);
  console.log(`Prisma migration records: ${migrations.length || "none (_prisma_migrations absent)"}`);
  for (const m of migrations) {
    console.log(`  - ${m.name} ${m.finished ? "(applied)" : "(STARTED BUT NEVER FINISHED)"}`);
  }

  if (missing.length === 0) {
    console.log("Core tables: all present ✓");
  } else {
    console.log(`Core tables MISSING (${missing.length}/${CORE_TABLES.length}): ${missing.join(", ")}`);
  }

  // Foreign tables are the signal that this database belongs to another app —
  // the case where wiping it would be destructive to something else.
  const unexpected = tables.filter((t) => t !== "_prisma_migrations" && !CORE_TABLES.includes(t));
  if (missing.length > 0 && unexpected.length > 0) {
    console.log(`Tables present that this app did not expect: ${unexpected.join(", ")}`);
    console.log("  ^ if these belong to another application, do NOT reset — use a separate database.");
  }

  if (process.env.DB_RESET === RESET_PHRASE) {
    console.log(`\n!! DB_RESET=${RESET_PHRASE} — dropping the public schema.`);
    console.log("!! Every table and every row is being deleted. This is not reversible.");
    await prisma.$executeRawUnsafe("DROP SCHEMA public CASCADE");
    await prisma.$executeRawUnsafe("CREATE SCHEMA public");
    console.log("!! Schema dropped and recreated. `prisma migrate deploy` will rebuild it.");
    console.log("!! CLEAR DB_RESET NOW or the next deploy wipes the database again.\n");
    return;
  }

  // An empty database is the normal first-deploy case, not a fault: the
  // `migrate deploy` step that runs next builds it from nothing. Only a
  // *populated* database missing core tables is a real mismatch.
  if (tables.length === 0) {
    console.log("Database is empty — `prisma migrate deploy` will create the schema.");
    console.log("=================\n");
    return;
  }

  if (missing.length > 0) {
    console.error(
      `\nThis database does not match the app: ${missing.length} core table(s) are missing,` +
        " but it is not empty, so `prisma migrate deploy` will not repair it on its own.\n" +
        `\nTo rebuild it, set DB_RESET=${RESET_PHRASE} in the Render environment, deploy` +
        " once, then CLEAR the variable. That deletes all data in this database.\n" +
        "\nIf the unexpected tables listed above belong to another application, do not" +
        " reset — point DATABASE_URL at a database of this app's own instead.\n",
    );
    // Fail the build deliberately. Deploying against a schema the app cannot
    // query only reproduces the 500s; stopping here keeps the last release live
    // instead of shipping a known-broken one.
    process.exit(1);
  }

  console.log("=================\n");
}

main()
  .catch((e) => {
    console.error("db-doctor: could not inspect the database.", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
