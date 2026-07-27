-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Board" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT 'brand',
    "kind" TEXT NOT NULL DEFAULT 'generic',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Board_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Board" ("archived", "color", "createdAt", "description", "id", "ownerId", "title", "updatedAt") SELECT "archived", "color", "createdAt", "description", "id", "ownerId", "title", "updatedAt" FROM "Board";
DROP TABLE "Board";
ALTER TABLE "new_Board" RENAME TO "Board";
CREATE INDEX "Board_ownerId_archived_idx" ON "Board"("ownerId", "archived");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
