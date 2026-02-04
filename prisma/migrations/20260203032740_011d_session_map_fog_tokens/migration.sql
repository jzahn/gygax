-- CreateEnum
CREATE TYPE "SessionTokenType" AS ENUM ('PC', 'NPC', 'MONSTER');

-- CreateTable
CREATE TABLE "session_map_states" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "revealedCells" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_map_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_tokens" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "position" JSONB NOT NULL,
    "type" "SessionTokenType" NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "characterId" TEXT,
    "npcId" TEXT,
    "color" TEXT NOT NULL DEFAULT '#666666',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_map_states_sessionId_idx" ON "session_map_states"("sessionId");

-- CreateIndex
CREATE INDEX "session_map_states_mapId_idx" ON "session_map_states"("mapId");

-- CreateIndex
CREATE UNIQUE INDEX "session_map_states_sessionId_mapId_key" ON "session_map_states"("sessionId", "mapId");

-- CreateIndex
CREATE INDEX "session_tokens_sessionId_mapId_idx" ON "session_tokens"("sessionId", "mapId");

-- AddForeignKey
ALTER TABLE "session_map_states" ADD CONSTRAINT "session_map_states_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_map_states" ADD CONSTRAINT "session_map_states_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "maps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_tokens" ADD CONSTRAINT "session_tokens_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
