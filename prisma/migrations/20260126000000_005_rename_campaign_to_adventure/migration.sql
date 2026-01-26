-- Rename Campaign → Adventure (Spec 005 Phase 1)
-- This aligns the database with the PRD terminology where:
-- - Campaign = Collection of Adventures (to be added)
-- - Adventure = Contains Maps (formerly "Campaign")

-- Step 1: Rename the campaigns table to adventures
ALTER TABLE "campaigns" RENAME TO "adventures";

-- Step 2: Rename the foreign key column in maps
ALTER TABLE "maps" RENAME COLUMN "campaignId" TO "adventureId";

-- Step 3: Rename the index on maps
ALTER INDEX "maps_campaignId_idx" RENAME TO "maps_adventureId_idx";

-- Step 4: Rename constraints (PostgreSQL auto-generates these names)
-- The foreign key constraint name is auto-generated as maps_campaignId_fkey
ALTER TABLE "maps" RENAME CONSTRAINT "maps_campaignId_fkey" TO "maps_adventureId_fkey";

-- The adventures (formerly campaigns) table's foreign key to users
ALTER TABLE "adventures" RENAME CONSTRAINT "campaigns_ownerId_fkey" TO "adventures_ownerId_fkey";

-- Step 5: Rename the primary key constraint
ALTER TABLE "adventures" RENAME CONSTRAINT "campaigns_pkey" TO "adventures_pkey";
