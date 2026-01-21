import Fastify from 'fastify'
import cors from '@fastify/cors'
import { prismaPlugin } from './plugins/prisma'
import { authPlugin } from './plugins/auth'
import { healthRoutes } from './routes/health'
import { authRoutes } from './routes/auth'

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
  await fastify.register(authPlugin)

  // Register routes
  await fastify.register(healthRoutes)
  await fastify.register(authRoutes)

  return fastify
}
