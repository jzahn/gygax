-- CreateTable
CREATE TABLE "backdrops" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "titleX" INTEGER NOT NULL DEFAULT 50,
    "titleY" INTEGER NOT NULL DEFAULT 50,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL,
    "focusX" INTEGER NOT NULL DEFAULT 50,
    "focusY" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adventureId" TEXT NOT NULL,

    CONSTRAINT "backdrops_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "backdrops_adventureId_idx" ON "backdrops"("adventureId");

-- AddForeignKey
ALTER TABLE "backdrops" ADD CONSTRAINT "backdrops_adventureId_fkey" FOREIGN KEY ("adventureId") REFERENCES "adventures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
