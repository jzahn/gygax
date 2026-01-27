-- CreateTable
CREATE TABLE "npcs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "class" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "alignment" TEXT,
    "title" TEXT,
    "strength" INTEGER,
    "intelligence" INTEGER,
    "wisdom" INTEGER,
    "dexterity" INTEGER,
    "constitution" INTEGER,
    "charisma" INTEGER,
    "hitPointsMax" INTEGER,
    "hitPointsCurrent" INTEGER,
    "armorClass" INTEGER,
    "saveDeathRay" INTEGER,
    "saveWands" INTEGER,
    "saveParalysis" INTEGER,
    "saveBreath" INTEGER,
    "saveSpells" INTEGER,
    "experiencePoints" INTEGER,
    "goldPieces" INTEGER,
    "equipment" TEXT,
    "spells" TEXT,
    "notes" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adventureId" TEXT NOT NULL,

    CONSTRAINT "npcs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "npcs_adventureId_idx" ON "npcs"("adventureId");

-- AddForeignKey
ALTER TABLE "npcs" ADD CONSTRAINT "npcs_adventureId_fkey" FOREIGN KEY ("adventureId") REFERENCES "adventures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
