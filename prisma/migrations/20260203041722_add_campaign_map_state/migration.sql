-- CreateTable
CREATE TABLE "campaign_map_states" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "revealedCells" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_map_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaign_map_states_campaignId_idx" ON "campaign_map_states"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_map_states_mapId_idx" ON "campaign_map_states"("mapId");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_map_states_campaignId_mapId_key" ON "campaign_map_states"("campaignId", "mapId");

-- AddForeignKey
ALTER TABLE "campaign_map_states" ADD CONSTRAINT "campaign_map_states_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_map_states" ADD CONSTRAINT "campaign_map_states_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "maps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
