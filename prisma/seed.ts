import { PrismaClient } from './generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required')
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Upsert ensures idempotency — safe to run multiple times
  await prisma.healthCheck.upsert({
    where: { id: 'healthcheck-seed' },
    update: {},
    create: {
      id: 'healthcheck-seed',
      status: 'ok',
    },
  })
  console.log('Seed complete: HealthCheck row created')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
