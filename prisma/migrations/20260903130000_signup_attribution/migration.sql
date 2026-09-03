-- AlterTable
ALTER TABLE "User" ADD COLUMN     "referralSource" TEXT;

-- Attribution is queried as "how many signups came from this link", so index the
-- tag rather than scanning the user table for each campaign.
CREATE INDEX "User_referralSource_idx" ON "User"("referralSource");
