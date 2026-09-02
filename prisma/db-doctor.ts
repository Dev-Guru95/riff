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
// EVERYTHING HERE IS SCOPED TO ONE POSTGRES SCHEMA — the `?schema=` parameter of
// DATABASE_URL, defaulting to `public`. Riff shares its database instance with
// another Soundring project, and on 2026-09-02 that project replaced Riff's
// tables in `public` with its own. Running Riff in its own named schema makes
// the two invisible to each other. Scoping matters most for the reset path: a
// hardcoded `DROP SCHEMA public` would destroy the co-tenant's data.
//
// Read-only unless DB_RESET is set to the exact confirmation phrase, in which
// case the app's own schema is dropped and recreated. The next build step
// (`prisma migrate deploy`) then rebuilds every table from the migrations. Set
// DB_RESET, deploy once, then CLEAR IT — left set, it wipes on every deploy.

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

/**
 * The schema Prisma is pointed at. Postgres identifiers are interpolated into
 * DDL below, so anything that is not a plain identifier is rejected outright
 * rather than quoted and hoped for.
 */
function targetSchema(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const schema = new URL(url).searchParams.get("schema") ?? "public";
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
    throw new Error(`Refusing to use an unsafe schema name from DATABASE_URL: ${schema}`);
  }
  return schema;
}

const SCHEMA = targetSchema();

async function listTables(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = ${SCHEMA} AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  return rows.map((r) => r.table_name);
}

async function listMigrations(): Promise<{ name: string; finished: boolean }[]> {
  try {
    const rows = await prisma.$queryRawUnsafe<{ migration_name: string; finished_at: Date | null }[]>(
      `SELECT migration_name, finished_at FROM "${SCHEMA}"."_prisma_migrations" ORDER BY started_at`,
    );
    return rows.map((r) => ({ name: r.migration_name, finished: r.finished_at !== null }));
  } catch {
    return []; // table absent — Prisma has never migrated this schema
  }
}

async function main() {
  console.log("\n=== db-doctor ===");
  console.log(`Target schema: ${SCHEMA}`);

  // `prisma migrate deploy` will not create a missing non-public schema, so it
  // is created here first. Idempotent, and a no-op for the default `public`.
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${SCHEMA}"`);

  const tables = await listTables();
  const migrations = await listMigrations();
  const missing = CORE_TABLES.filter((t) => !tables.includes(t));

  console.log(`Tables in schema: ${tables.length}`);
  console.log(`Prisma migration records: ${migrations.length || "none (_prisma_migrations absent)"}`);
  for (const m of migrations) {
    console.log(`  - ${m.name} ${m.finished ? "(applied)" : "(STARTED BUT NEVER FINISHED)"}`);
  }

  if (missing.length === 0 && tables.length > 0) {
    console.log("Core tables: all present ✓");
  } else if (missing.length > 0) {
    console.log(`Core tables MISSING (${missing.length}/${CORE_TABLES.length}): ${missing.join(", ")}`);
  }

  // Tables this app never created are the signal that the schema belongs to
  // someone else — the case where wiping it destroys another application.
  const unexpected = tables.filter((t) => t !== "_prisma_migrations" && !CORE_TABLES.includes(t));
  if (missing.length > 0 && unexpected.length > 0) {
    console.log(`Tables present that this app did not expect: ${unexpected.join(", ")}`);
    console.log(`  ^ if these belong to another application, do NOT reset — run this app in`);
    console.log(`    its own schema instead by appending ?schema=riff to DATABASE_URL.`);
  }

  if (process.env.DB_RESET === RESET_PHRASE) {
    console.log(`\n!! DB_RESET=${RESET_PHRASE} — dropping schema "${SCHEMA}".`);
    console.log("!! Every table and every row in it is being deleted. This is not reversible.");
    await prisma.$executeRawUnsafe(`DROP SCHEMA "${SCHEMA}" CASCADE`);
    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${SCHEMA}"`);
    console.log("!! Schema dropped and recreated. `prisma migrate deploy` will rebuild it.");
    console.log("!! CLEAR DB_RESET NOW or the next deploy wipes it again.\n");
    return;
  }

  // An empty schema is the normal first-deploy case, not a fault: the
  // `migrate deploy` step that runs next builds it from nothing. Only a
  // *populated* schema missing core tables is a real mismatch.
  if (tables.length === 0) {
    console.log(`Schema "${SCHEMA}" is empty — \`prisma migrate deploy\` will create the tables.`);
    console.log("=================\n");
    return;
  }

  if (missing.length > 0) {
    console.error(
      `\nSchema "${SCHEMA}" does not match the app: ${missing.length} core table(s) are` +
        " missing, but it is not empty, so `prisma migrate deploy` will not repair it.\n" +
        "\nIf the unexpected tables above belong to another application, do NOT reset." +
        " Append ?schema=riff to DATABASE_URL so this app gets a schema of its own.\n" +
        `\nOtherwise set DB_RESET=${RESET_PHRASE} in the Render environment, deploy once,` +
        " then CLEAR the variable. That deletes all data in this schema.\n",
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
