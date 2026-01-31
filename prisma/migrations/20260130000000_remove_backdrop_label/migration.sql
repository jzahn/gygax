-- Remove backdrop label fields (title, titleX, titleY)
ALTER TABLE "backdrops" DROP COLUMN "title";
ALTER TABLE "backdrops" DROP COLUMN "titleX";
ALTER TABLE "backdrops" DROP COLUMN "titleY";
