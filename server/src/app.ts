import Fastify from 'fastify'
import cors from '@fastify/cors'
import { prismaPlugin } from './plugins/prisma'
import { healthRoutes } from './routes/health'

export async function buildApp() {
  const fastify = Fastify({
    logger: true,
  })

  // Register CORS
  await fastify.register(cors, {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })

  // Register plugins
  await fastify.register(prismaPlugin)

  // Register routes
  await fastify.register(healthRoutes)

  return fastify
}
