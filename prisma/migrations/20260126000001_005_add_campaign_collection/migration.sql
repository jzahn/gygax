-- Add Campaign collection entity (Spec 005 Phase 2)
-- Campaign is a parent collection that groups Adventures
-- PRD hierarchy: Campaign → Adventures → Maps

-- Create the campaigns table
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "bannerImageUrl" TEXT,
    "bannerHotspotX" DOUBLE PRECISION DEFAULT 50,
    "bannerHotspotY" DOUBLE PRECISION DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- Add campaignId to adventures (optional - allows standalone adventures)
ALTER TABLE "adventures" ADD COLUMN "campaignId" TEXT;

-- Create index on adventures.campaignId
CREATE INDEX "adventures_campaignId_idx" ON "adventures"("campaignId");

-- Add foreign key from campaigns to users
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add foreign key from adventures to campaigns (SetNull on delete)
ALTER TABLE "adventures" ADD CONSTRAINT "adventures_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
