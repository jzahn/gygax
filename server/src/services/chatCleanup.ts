import type { PrismaClient } from '../../prisma/generated/prisma/index.js'

// Message retention period: 1 month
const RETENTION_DAYS = 30

/**
 * Delete chat messages older than the retention period.
 */
export async function cleanupOldMessages(prisma: PrismaClient): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS)

  const result = await prisma.chatMessage.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  })

  return result.count
}

/**
 * Schedule chat cleanup to run daily at 3:00 AM server time.
 */
export function scheduleChatCleanup(prisma: PrismaClient): void {
  // Calculate milliseconds until next 3:00 AM
  const now = new Date()
  const next3AM = new Date(now)
  next3AM.setHours(3, 0, 0, 0)

  // If it's already past 3:00 AM today, schedule for tomorrow
  if (now >= next3AM) {
    next3AM.setDate(next3AM.getDate() + 1)
  }

  const msUntilNext3AM = next3AM.getTime() - now.getTime()

  console.log(`[Chat Cleanup] First cleanup scheduled for ${next3AM.toISOString()}`)

  // Schedule the first run
  setTimeout(() => {
    runCleanup(prisma)

    // After the first run, schedule subsequent runs every 24 hours
    setInterval(
      () => {
        runCleanup(prisma)
      },
      24 * 60 * 60 * 1000
    ) // 24 hours
  }, msUntilNext3AM)
}

async function runCleanup(prisma: PrismaClient): Promise<void> {
  console.log('[Chat Cleanup] Running scheduled cleanup...')

  try {
    const deletedCount = await cleanupOldMessages(prisma)
    console.log(`[Chat Cleanup] Deleted ${deletedCount} messages older than ${RETENTION_DAYS} days`)
  } catch (error) {
    console.error('[Chat Cleanup] Error during cleanup:', error)
  }
}
