import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import type { SessionListItem, SessionStatus, SessionAccessType } from '@gygax/shared'

// Connected SSE clients
const clients = new Map<string, FastifyReply>()

function formatSessionListItem(session: {
  id: string
  status: string
  accessType: string
  adventureId: string
  createdAt: Date
  adventure: { id: string; name: string }
  dm: { id: string; name: string; avatarUrl: string | null }
  _count: { participants: number }
}): SessionListItem {
  return {
    id: session.id,
    status: session.status as SessionStatus,
    accessType: session.accessType as SessionAccessType,
    adventureId: session.adventureId,
    createdAt: session.createdAt.toISOString(),
    adventure: {
      id: session.adventure.id,
      name: session.adventure.name,
    },
    dm: {
      id: session.dm.id,
      name: session.dm.name,
      avatarUrl: session.dm.avatarUrl,
    },
    participantCount: session._count.participants,
  }
}

// Broadcast to all connected SSE clients
export function broadcastSessionEvent(
  event: 'session:created' | 'session:updated' | 'session:ended',
  session: SessionListItem
): void {
  const data = JSON.stringify({ event, session })

  for (const [clientId, reply] of clients) {
    try {
      reply.raw.write(`event: ${event}\ndata: ${data}\n\n`)
    } catch {
      // Client disconnected, remove from map
      clients.delete(clientId)
    }
  }
}

// Broadcast session ended (just needs ID)
export function broadcastSessionEnded(sessionId: string): void {
  const data = JSON.stringify({ event: 'session:ended', sessionId })

  for (const [clientId, reply] of clients) {
    try {
      reply.raw.write(`event: session:ended\ndata: ${data}\n\n`)
    } catch {
      clients.delete(clientId)
    }
  }
}

export async function sessionBrowseSSERoutes(fastify: FastifyInstance) {
  // GET /api/sessions/browse/events - SSE endpoint for session updates
  fastify.get(
    '/api/sessions/browse/events',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Require authentication
      if (!request.user) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Not authenticated',
        })
      }

      const user = await fastify.prisma.user.findUnique({
        where: { id: request.user.id },
        select: { id: true, emailVerified: true },
      })

      if (!user || !user.emailVerified) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Email not verified',
        })
      }

      // Set SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      })

      // Generate unique client ID
      const clientId = `${user.id}-${Date.now()}`
      clients.set(clientId, reply)

      // Send initial connection event
      reply.raw.write(`event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`)

      // Keep connection alive with periodic comments
      const keepAlive = setInterval(() => {
        try {
          reply.raw.write(': keepalive\n\n')
        } catch {
          clearInterval(keepAlive)
          clients.delete(clientId)
        }
      }, 30000)

      // Clean up on disconnect
      request.raw.on('close', () => {
        clearInterval(keepAlive)
        clients.delete(clientId)
      })

      // Don't end the response - keep it open for SSE
      // Fastify will handle cleanup when client disconnects
    }
  )
}

// Helper to fetch and format a session for broadcasting
export async function fetchSessionForBroadcast(
  prisma: FastifyInstance['prisma'],
  sessionId: string
): Promise<SessionListItem | null> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      adventure: { select: { id: true, name: true } },
      dm: { select: { id: true, name: true, avatarUrl: true } },
      _count: { select: { participants: { where: { leftAt: null } } } },
    },
  })

  if (!session) return null

  return formatSessionListItem(session)
}
