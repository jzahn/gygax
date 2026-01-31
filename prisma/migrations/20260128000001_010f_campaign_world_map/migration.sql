-- AlterTable
ALTER TABLE "maps" ALTER COLUMN "adventureId" DROP NOT NULL;

-- AddColumn
ALTER TABLE "maps" ADD COLUMN "campaignId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "maps_campaignId_key" ON "maps"("campaignId");

-- AddForeignKey
ALTER TABLE "maps" ADD CONSTRAINT "maps_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
