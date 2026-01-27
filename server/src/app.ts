import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import { prismaPlugin } from './plugins/prisma'
import { authPlugin } from './plugins/auth'
import { healthRoutes } from './routes/health'
import { authRoutes } from './routes/auth'
import { adventureRoutes } from './routes/adventures'
import { campaignRoutes } from './routes/campaigns'
import { mapRoutes } from './routes/maps'
import { characterRoutes } from './routes/characters'
import { initializeBucket } from './services/storage'

export async function buildApp() {
  const fastify = Fastify({
    logger: true,
  })

  // Register CORS
  await fastify.register(cors, {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  // Register multipart for file uploads
  await fastify.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    },
  })

  // Register plugins
  await fastify.register(prismaPlugin)
  await fastify.register(authPlugin)

  // Initialize S3 bucket
  try {
    await initializeBucket()
    fastify.log.info('S3 bucket initialized')
  } catch (error) {
    fastify.log.error(error, 'Failed to initialize S3 bucket')
  }

  // Register routes
  await fastify.register(healthRoutes)
  await fastify.register(authRoutes)
  await fastify.register(campaignRoutes)
  await fastify.register(adventureRoutes)
  await fastify.register(mapRoutes)
  await fastify.register(characterRoutes)

  return fastify
}
