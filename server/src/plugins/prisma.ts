import { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { PrismaClient } from '../../../prisma/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
  }
}

async function prismaPluginCallback(fastify: FastifyInstance) {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  const adapter = new PrismaPg({ connectionString })
  const prisma = new PrismaClient({ adapter })

  fastify.decorate('prisma', prisma)

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect()
  })
}

export const prismaPlugin = fp(prismaPluginCallback)
