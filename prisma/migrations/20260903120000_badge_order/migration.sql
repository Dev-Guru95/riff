-- AlterTable
ALTER TABLE "Badge" ADD COLUMN     "orderIndex" INTEGER NOT NULL DEFAULT 500;

-- Backfill the badges the seed creates, so existing rows take their canonical
-- positions without waiting for a re-seed. Journey badges first, then the
-- program capstone; track badges are positioned by awardTrackBadge().
UPDATE "Badge" SET "orderIndex" = 10 WHERE "key" = 'first_steps';
UPDATE "Badge" SET "orderIndex" = 20 WHERE "key" = 'quiz_whiz';
UPDATE "Badge" SET "orderIndex" = 30 WHERE "key" = 'first_submission';
UPDATE "Badge" SET "orderIndex" = 40 WHERE "key" = 'streak_7';
UPDATE "Badge" SET "orderIndex" = 50 WHERE "key" = 'mission_marathon';
UPDATE "Badge" SET "orderIndex" = 900 WHERE "key" = 'program_graduate';
