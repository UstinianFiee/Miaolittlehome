-- CreateTable
CREATE TABLE "Shuoshuo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "content" TEXT NOT NULL,
    "contentEn" TEXT,
    "images" TEXT NOT NULL DEFAULT '[]',
    "location" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Shuoshuo_published_createdAt_idx" ON "Shuoshuo"("published", "createdAt");
