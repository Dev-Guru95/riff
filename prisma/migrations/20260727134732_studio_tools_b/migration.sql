-- CreateTable
CREATE TABLE "CareerGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "targetDate" DATETIME,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "milestones" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CareerGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Fan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "source" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Fan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Broadcast" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "segment" TEXT NOT NULL DEFAULT '',
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Broadcast_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LinkPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL DEFAULT '',
    "theme" TEXT NOT NULL DEFAULT 'brand',
    "links" TEXT NOT NULL DEFAULT '[]',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LinkPage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contact" TEXT NOT NULL DEFAULT '',
    "date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'inquiry',
    "fee" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CareerGoal_userId_status_idx" ON "CareerGoal"("userId", "status");

-- CreateIndex
CREATE INDEX "Fan_userId_createdAt_idx" ON "Fan"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Broadcast_userId_createdAt_idx" ON "Broadcast"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LinkPage_userId_key" ON "LinkPage"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LinkPage_handle_key" ON "LinkPage"("handle");

-- CreateIndex
CREATE INDEX "Booking_userId_date_idx" ON "Booking"("userId", "date");
