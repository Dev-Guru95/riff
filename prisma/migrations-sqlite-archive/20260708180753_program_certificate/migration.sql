/*
  Warnings:

  - You are about to drop the column `courseId` on the `Certificate` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Certificate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serial" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "programKey" TEXT NOT NULL DEFAULT 'riff',
    "title" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Certificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Certificate" ("id", "issuedAt", "serial", "title", "userId") SELECT "id", "issuedAt", "serial", "title", "userId" FROM "Certificate";
DROP TABLE "Certificate";
ALTER TABLE "new_Certificate" RENAME TO "Certificate";
CREATE UNIQUE INDEX "Certificate_serial_key" ON "Certificate"("serial");
CREATE INDEX "Certificate_userId_issuedAt_idx" ON "Certificate"("userId", "issuedAt");
CREATE UNIQUE INDEX "Certificate_userId_programKey_key" ON "Certificate"("userId", "programKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
