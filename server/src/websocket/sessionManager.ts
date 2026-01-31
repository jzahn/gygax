import type { WebSocket } from 'ws'
import type { WSConnectedUser, WSSessionState, SessionWithDetails } from '@gygax/shared'

export interface ConnectedUser extends WSConnectedUser {
  socket: WebSocket
  connectedAt: Date
  lastPing: Date
}

// Map of sessionId → Map of userId → ConnectedUser
const sessions = new Map<string, Map<string, ConnectedUser>>()

// Ping timeout in ms (120 seconds)
const PING_TIMEOUT = 120000

export function addUserToSession(
  sessionId: string,
  userId: string,
  userData: Omit<ConnectedUser, 'connectedAt' | 'lastPing'>
): void {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, new Map())
  }
  const sessionUsers = sessions.get(sessionId)!

  const now = new Date()
  sessionUsers.set(userId, {
    ...userData,
    connectedAt: now,
    lastPing: now,
  })
  console.log(`[WS] Added user ${userId} to session ${sessionId}. Total users: ${sessionUsers.size}`)
}

export function removeUserFromSession(sessionId: string, userId: string, socket?: WebSocket): void {
  const sessionUsers = sessions.get(sessionId)
  if (sessionUsers) {
    // If a socket is provided, only remove if it matches the current socket
    // This prevents a race condition where an old socket closing removes a new connection
    if (socket) {
      const user = sessionUsers.get(userId)
      if (user && user.socket !== socket) {
        // The stored socket is different - a new connection replaced this one
        console.log(`[WS] removeUserFromSession: Skipping removal of ${userId} - socket mismatch`)
        return
      }
    }
    sessionUsers.delete(userId)
    console.log(`[WS] Removed user ${userId} from session ${sessionId}. Remaining users: ${sessionUsers.size}`)
    if (sessionUsers.size === 0) {
      sessions.delete(sessionId)
      console.log(`[WS] Deleted empty session ${sessionId}`)
    }
  }
}

export function getUserInSession(sessionId: string, userId: string): ConnectedUser | undefined {
  return sessions.get(sessionId)?.get(userId)
}

export function getSessionUsers(sessionId: string): Map<string, ConnectedUser> | undefined {
  return sessions.get(sessionId)
}

export function getConnectedUsers(sessionId: string): WSConnectedUser[] {
  const sessionUsers = sessions.get(sessionId)
  if (!sessionUsers) return []

  return Array.from(sessionUsers.values()).map((user) => ({
    userId: user.userId,
    userName: user.userName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    characterId: user.characterId,
    characterName: user.characterName,
  }))
}

export function updateUserPing(sessionId: string, userId: string): void {
  const user = sessions.get(sessionId)?.get(userId)
  if (user) {
    user.lastPing = new Date()
  }
}

export function broadcastToSession(
  sessionId: string,
  message: object,
  excludeUserId?: string
): void {
  const sessionUsers = sessions.get(sessionId)
  if (!sessionUsers) {
    console.log(`[WS] Broadcast to session ${sessionId}: no users found`)
    return
  }

  const messageStr = JSON.stringify(message)
  const msgType = (message as { type?: string }).type || 'unknown'
  console.log(`[WS] Broadcasting ${msgType} to session ${sessionId}. Users: ${Array.from(sessionUsers.keys()).join(', ')}`)

  for (const [userId, user] of sessionUsers) {
    if (excludeUserId && userId === excludeUserId) continue
    if (user.socket.readyState === 1) { // OPEN
      user.socket.send(messageStr)
      console.log(`[WS] Sent ${msgType} to user ${userId}`)
    } else {
      console.log(`[WS] Skipped user ${userId} - socket not open (state: ${user.socket.readyState})`)
    }
  }
}

export function sendToUser(sessionId: string, userId: string, message: object): void {
  const user = sessions.get(sessionId)?.get(userId)
  if (user && user.socket.readyState === 1) {
    user.socket.send(JSON.stringify(message))
  }
}

export function buildSessionState(
  session: SessionWithDetails,
  sessionId: string
): WSSessionState {
  return {
    session,
    connectedUsers: getConnectedUsers(sessionId),
  }
}

// Clean up stale connections (no ping in 120 seconds)
export function cleanupStaleConnections(): void {
  const now = Date.now()

  for (const [sessionId, sessionUsers] of sessions) {
    for (const [userId, user] of sessionUsers) {
      if (now - user.lastPing.getTime() > PING_TIMEOUT) {
        // Close the socket
        try {
          user.socket.close(1000, 'Connection timeout')
        } catch {
          // Ignore close errors
        }
        sessionUsers.delete(userId)
      }
    }

    if (sessionUsers.size === 0) {
      sessions.delete(sessionId)
    }
  }
}

// Start cleanup interval
setInterval(cleanupStaleConnections, 30000) // Every 30 seconds
