-- AlterTable
ALTER TABLE "CoachMemory" ADD COLUMN     "sourceKey" TEXT;

-- One memory per (user, source). Postgres treats NULLs as distinct, so the
-- existing chat/audit-derived memories (sourceKey NULL) are unaffected and stay
-- append-only; only keyed memories such as "assignment:<id>" are deduplicated.
CREATE UNIQUE INDEX "CoachMemory_userId_sourceKey_key" ON "CoachMemory"("userId", "sourceKey");
