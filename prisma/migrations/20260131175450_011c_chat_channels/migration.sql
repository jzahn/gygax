-- CreateEnum
CREATE TYPE "ChatMessageType" AS ENUM ('TEXT', 'ROLL', 'SYSTEM');

-- CreateTable
CREATE TABLE "chat_channels" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_channel_participants" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_channel_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "ChatMessageType" NOT NULL DEFAULT 'TEXT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channelId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "diceExpression" TEXT,
    "diceRolls" JSONB,
    "diceTotal" INTEGER,
    "diceModifier" INTEGER,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_channels_sessionId_idx" ON "chat_channels"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_channel_participants_channelId_userId_key" ON "chat_channel_participants"("channelId", "userId");

-- CreateIndex
CREATE INDEX "chat_messages_channelId_createdAt_idx" ON "chat_messages"("channelId", "createdAt");

-- AddForeignKey
ALTER TABLE "chat_channels" ADD CONSTRAINT "chat_channels_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_channel_participants" ADD CONSTRAINT "chat_channel_participants_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "chat_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_channel_participants" ADD CONSTRAINT "chat_channel_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "chat_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
