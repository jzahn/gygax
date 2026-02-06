-- AlterEnum
ALTER TYPE "SessionTokenType" ADD VALUE 'PARTY';

-- AlterTable
ALTER TABLE "characters" ADD COLUMN     "avatarHotspotX" DOUBLE PRECISION DEFAULT 50,
ADD COLUMN     "avatarHotspotY" DOUBLE PRECISION DEFAULT 50;

-- AlterTable
ALTER TABLE "npcs" ADD COLUMN     "avatarHotspotX" DOUBLE PRECISION DEFAULT 50,
ADD COLUMN     "avatarHotspotY" DOUBLE PRECISION DEFAULT 50;

-- AlterTable
ALTER TABLE "session_tokens" ADD COLUMN     "imageHotspotX" DOUBLE PRECISION,
ADD COLUMN     "imageHotspotY" DOUBLE PRECISION,
ADD COLUMN     "monsterId" TEXT;

-- CreateTable
CREATE TABLE "monsters" (
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
    "avatarHotspotX" DOUBLE PRECISION DEFAULT 50,
    "avatarHotspotY" DOUBLE PRECISION DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "adventureId" TEXT NOT NULL,

    CONSTRAINT "monsters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monsters_adventureId_idx" ON "monsters"("adventureId");

-- AddForeignKey
ALTER TABLE "monsters" ADD CONSTRAINT "monsters_adventureId_fkey" FOREIGN KEY ("adventureId") REFERENCES "adventures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
