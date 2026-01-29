import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { WebSocket } from 'ws'
import { validateWsToken } from '../routes/sessions.js'
import { handleConnection } from './handlers.js'

export async function websocketRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Params: { sessionId: string }
    Querystring: { token: string }
  }>(
    '/ws/sessions/:sessionId',
    { websocket: true },
    async (
      socket: WebSocket,
      request: FastifyRequest<{
        Params: { sessionId: string }
        Querystring: { token: string }
      }>
    ) => {
      const { sessionId } = request.params
      const { token } = request.query

      // Validate token
      if (!token) {
        socket.close(1008, 'Missing authentication token')
        return
      }

      const tokenData = validateWsToken(token)
      if (!tokenData) {
        socket.close(1008, 'Invalid or expired token')
        return
      }

      // Verify token is for this session
      if (tokenData.sessionId !== sessionId) {
        socket.close(1008, 'Token not valid for this session')
        return
      }

      // Handle the connection
      await handleConnection(fastify, socket, sessionId, tokenData.userId)
    }
  )
}
