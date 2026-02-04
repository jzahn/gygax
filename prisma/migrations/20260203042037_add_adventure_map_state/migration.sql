-- CreateTable
CREATE TABLE "adventure_map_states" (
    "id" TEXT NOT NULL,
    "adventureId" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "revealedCells" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adventure_map_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "adventure_map_states_adventureId_idx" ON "adventure_map_states"("adventureId");

-- CreateIndex
CREATE INDEX "adventure_map_states_mapId_idx" ON "adventure_map_states"("mapId");

-- CreateIndex
CREATE UNIQUE INDEX "adventure_map_states_adventureId_mapId_key" ON "adventure_map_states"("adventureId", "mapId");

-- AddForeignKey
ALTER TABLE "adventure_map_states" ADD CONSTRAINT "adventure_map_states_adventureId_fkey" FOREIGN KEY ("adventureId") REFERENCES "adventures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adventure_map_states" ADD CONSTRAINT "adventure_map_states_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "maps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
