-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('FORMING', 'ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "SessionAccessType" AS ENUM ('OPEN', 'CAMPAIGN', 'INVITE');

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'FORMING',
    "accessType" "SessionAccessType" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "adventureId" TEXT NOT NULL,
    "dmId" TEXT NOT NULL,
    "activeMapId" TEXT,
    "activeBackdropId" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_participants" (
    "id" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,

    CONSTRAINT "session_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_members" (
    "id" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "campaign_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_invites" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "sessionId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,

    CONSTRAINT "session_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sessions_adventureId_idx" ON "sessions"("adventureId");

-- CreateIndex
CREATE INDEX "sessions_dmId_idx" ON "sessions"("dmId");

-- CreateIndex
CREATE INDEX "sessions_status_idx" ON "sessions"("status");

-- CreateIndex
CREATE INDEX "sessions_accessType_idx" ON "sessions"("accessType");

-- CreateIndex
CREATE INDEX "session_participants_sessionId_idx" ON "session_participants"("sessionId");

-- CreateIndex
CREATE INDEX "session_participants_userId_idx" ON "session_participants"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_participants_sessionId_userId_key" ON "session_participants"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "campaign_members_campaignId_idx" ON "campaign_members"("campaignId");

-- CreateIndex
CREATE INDEX "campaign_members_userId_idx" ON "campaign_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_members_campaignId_userId_key" ON "campaign_members"("campaignId", "userId");

-- CreateIndex
CREATE INDEX "session_invites_sessionId_idx" ON "session_invites"("sessionId");

-- CreateIndex
CREATE INDEX "session_invites_userId_idx" ON "session_invites"("userId");

-- CreateIndex
CREATE INDEX "session_invites_email_idx" ON "session_invites"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_invites_sessionId_userId_key" ON "session_invites"("sessionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_invites_sessionId_email_key" ON "session_invites"("sessionId", "email");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_adventureId_fkey" FOREIGN KEY ("adventureId") REFERENCES "adventures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_dmId_fkey" FOREIGN KEY ("dmId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_members" ADD CONSTRAINT "campaign_members_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_members" ADD CONSTRAINT "campaign_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_invites" ADD CONSTRAINT "session_invites_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_invites" ADD CONSTRAINT "session_invites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
