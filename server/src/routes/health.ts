import { FastifyInstance } from 'fastify'
import type { HealthCheckResponse } from '@gygax/shared'

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get<{ Reply: HealthCheckResponse }>('/api/health', async () => {
    const apiStart = Date.now()

    let dbStatus: 'up' | 'down' = 'down'
    let dbResponseTime = 0
    let dbError: string | null = null

    try {
      const dbStart = Date.now()
      const healthRow = await fastify.prisma.healthCheck.findUnique({
        where: { id: 'healthcheck-seed' },
      })
      dbResponseTime = Date.now() - dbStart

      if (healthRow?.status === 'ok') {
        dbStatus = 'up'
      } else {
        dbError = 'Health check row not found or status not ok'
      }
    } catch (error) {
      dbError = error instanceof Error ? error.message : 'Unknown database error'
    }

    const apiResponseTime = Date.now() - apiStart

    const response: HealthCheckResponse = {
      status: dbStatus === 'up' ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        api: {
          status: 'up',
          responseTime: apiResponseTime,
        },
        database: {
          status: dbStatus,
          responseTime: dbResponseTime,
          error: dbError,
        },
      },
    }

    return response
  })
}
