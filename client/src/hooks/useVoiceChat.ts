import { useState, useEffect, useRef, useCallback } from 'react'
import type { WSConnectedUser } from '@gygax/shared'

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

// Audio level threshold for speaking detection
const SPEAKING_THRESHOLD = 0.01
const SPEAKING_CHECK_INTERVAL = 100

interface UseVoiceChatOptions {
  userId: string
  connectedUsers: WSConnectedUser[]
  enabled?: boolean
  sendMessage: (type: string, payload: unknown) => void
}

interface UseVoiceChatReturn {
  isMuted: boolean
  toggleMute: () => void
  speakingUsers: Set<string>
  audioEnabled: boolean
  error: string | null
  onRtcOffer: (fromUserId: string, sdp: RTCSessionDescriptionInit) => void
  onRtcAnswer: (fromUserId: string, sdp: RTCSessionDescriptionInit) => void
  onRtcIceCandidate: (fromUserId: string, candidate: RTCIceCandidateInit) => void
}

interface PeerConnection {
  pc: RTCPeerConnection
  audioElement: HTMLAudioElement
  analyser?: AnalyserNode
  audioContext?: AudioContext
}

export function useVoiceChat({
  userId,
  connectedUsers,
  enabled = true,
  sendMessage,
}: UseVoiceChatOptions): UseVoiceChatReturn {
  const [isMuted, setIsMuted] = useState(false)
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set())
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map())
  const speakingIntervalRef = useRef<number | null>(null)
  const mountedRef = useRef(true)
  const isMutedRef = useRef(false)

  // Get local audio stream
  const initializeAudio = useCallback(async () => {
    if (!enabled || localStreamRef.current) return

    try {
      // TODO: Consider making these user-configurable settings
      // echoCancellation and noiseSuppression can cause audio pulsing/gating
      // in some environments, but are helpful for preventing feedback
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: true,
          autoGainControl: false,
        },
        video: false,
      })

      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      // Apply current mute state to new tracks
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !isMutedRef.current
      })

      localStreamRef.current = stream
      setAudioEnabled(true)
      setError(null)
    } catch {
      if (mountedRef.current) {
        setError('Microphone access denied')
        setAudioEnabled(false)
      }
    }
  }, [enabled])

  // Create peer connection for a user
  const createPeerConnection = useCallback(
    (remoteUserId: string): PeerConnection => {
      const pc = new RTCPeerConnection(RTC_CONFIG)
      const audioElement = new Audio()
      audioElement.autoplay = true

      // Add local stream tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          if (localStreamRef.current) {
            pc.addTrack(track, localStreamRef.current)
          }
        })
      }

      // Handle incoming audio
      pc.ontrack = (event) => {
        if (event.streams[0]) {
          audioElement.srcObject = event.streams[0]

          // Set up audio analysis for speaking detection
          try {
            const audioContext = new AudioContext()
            const source = audioContext.createMediaStreamSource(event.streams[0])
            const analyser = audioContext.createAnalyser()
            analyser.fftSize = 256
            source.connect(analyser)

            const conn = peerConnectionsRef.current.get(remoteUserId)
            if (conn) {
              conn.analyser = analyser
              conn.audioContext = audioContext
            }
          } catch {
            // Audio analysis setup failed - speaking detection won't work for this peer
          }
        }
      }

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendMessage('rtc:ice-candidate', {
            targetUserId: remoteUserId,
            candidate: event.candidate.toJSON(),
          })
        }
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          // Connection failed - could retry here
        }
      }

      return { pc, audioElement }
    },
    [sendMessage]
  )

  // Initiate connection to a user (we are the offerer)
  const initiateConnection = useCallback(
    async (remoteUserId: string) => {
      if (!localStreamRef.current) return

      // Close existing connection if any
      const existing = peerConnectionsRef.current.get(remoteUserId)
      if (existing) {
        existing.pc.close()
        existing.audioElement.srcObject = null
        existing.audioContext?.close()
      }

      const conn = createPeerConnection(remoteUserId)
      peerConnectionsRef.current.set(remoteUserId, conn)

      try {
        const offer = await conn.pc.createOffer()
        await conn.pc.setLocalDescription(offer)

        sendMessage('rtc:offer', {
          targetUserId: remoteUserId,
          sdp: conn.pc.localDescription,
        })
      } catch (err) {
        console.error('Failed to create offer:', err)
      }
    },
    [createPeerConnection, sendMessage]
  )

  // Handle incoming offer
  const onRtcOffer = useCallback(
    async (fromUserId: string, sdp: RTCSessionDescriptionInit) => {
      if (!localStreamRef.current) return

      // Close existing connection if any
      const existing = peerConnectionsRef.current.get(fromUserId)
      if (existing) {
        existing.pc.close()
        existing.audioElement.srcObject = null
        existing.audioContext?.close()
      }

      const conn = createPeerConnection(fromUserId)
      peerConnectionsRef.current.set(fromUserId, conn)

      try {
        await conn.pc.setRemoteDescription(new RTCSessionDescription(sdp))
        const answer = await conn.pc.createAnswer()
        await conn.pc.setLocalDescription(answer)

        sendMessage('rtc:answer', {
          targetUserId: fromUserId,
          sdp: conn.pc.localDescription,
        })
      } catch (err) {
        console.error('Failed to handle offer:', err)
      }
    },
    [createPeerConnection, sendMessage]
  )

  // Handle incoming answer
  const onRtcAnswer = useCallback(async (fromUserId: string, sdp: RTCSessionDescriptionInit) => {
    const conn = peerConnectionsRef.current.get(fromUserId)
    if (!conn) return

    try {
      await conn.pc.setRemoteDescription(new RTCSessionDescription(sdp))
    } catch (err) {
      console.error('Failed to handle answer:', err)
    }
  }, [])

  // Handle incoming ICE candidate
  const onRtcIceCandidate = useCallback(
    async (fromUserId: string, candidate: RTCIceCandidateInit) => {
      const conn = peerConnectionsRef.current.get(fromUserId)
      if (!conn) return

      try {
        await conn.pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (err) {
        console.error('Failed to add ICE candidate:', err)
      }
    },
    []
  )

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return

    // Use ref for reliable current value (avoids stale closure issues)
    const newMuted = !isMutedRef.current
    isMutedRef.current = newMuted
    setIsMuted(newMuted)

    // Enable/disable audio track on local stream
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !newMuted
    })

    // Also update all RTCRtpSenders to ensure mute propagates through peer connections
    for (const [, conn] of peerConnectionsRef.current) {
      for (const sender of conn.pc.getSenders()) {
        if (sender.track?.kind === 'audio') {
          sender.track.enabled = !newMuted
        }
      }
    }

    // Broadcast mute state
    sendMessage('rtc:mute-state', { muted: newMuted })
  }, [sendMessage])

  // Initialize audio on mount
  useEffect(() => {
    mountedRef.current = true
    initializeAudio()

    return () => {
      mountedRef.current = false
    }
  }, [initializeAudio])

  // Connect to existing users when we join
  useEffect(() => {
    if (!audioEnabled || !enabled) return

    // Get list of users we should be connected to (excluding self)
    const targetUserIds = connectedUsers
      .filter((u) => u.userId !== userId)
      .map((u) => u.userId)

    // Initiate connections to users we're not connected to yet
    // Only initiate if our userId is "greater" to avoid both sides initiating
    for (const remoteUserId of targetUserIds) {
      if (!peerConnectionsRef.current.has(remoteUserId)) {
        // The user who joined later (has the greater connection) initiates
        // Since we just connected, we should initiate to existing users
        // Actually, spec says: "newer user (joiner) creates offer"
        // So we initiate to all existing users
        initiateConnection(remoteUserId)
      }
    }

    // Clean up connections for users who left
    for (const [remoteUserId, conn] of peerConnectionsRef.current) {
      if (!targetUserIds.includes(remoteUserId)) {
        conn.pc.close()
        conn.audioElement.srcObject = null
        conn.audioContext?.close()
        peerConnectionsRef.current.delete(remoteUserId)
      }
    }
  }, [audioEnabled, enabled, connectedUsers, userId, initiateConnection])

  // Speaking detection interval
  useEffect(() => {
    if (!audioEnabled) return

    speakingIntervalRef.current = window.setInterval(() => {
      const speaking = new Set<string>()

      for (const [remoteUserId, conn] of peerConnectionsRef.current) {
        if (conn.analyser) {
          const dataArray = new Uint8Array(conn.analyser.frequencyBinCount)
          conn.analyser.getByteFrequencyData(dataArray)

          // Calculate average level
          const sum = dataArray.reduce((a, b) => a + b, 0)
          const average = sum / dataArray.length / 255

          if (average > SPEAKING_THRESHOLD) {
            speaking.add(remoteUserId)
          }
        }
      }

      setSpeakingUsers(speaking)
    }, SPEAKING_CHECK_INTERVAL)

    return () => {
      if (speakingIntervalRef.current) {
        clearInterval(speakingIntervalRef.current)
      }
    }
  }, [audioEnabled])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop())
        localStreamRef.current = null
      }

      // Close all peer connections
      for (const [, conn] of peerConnectionsRef.current) {
        conn.pc.close()
        conn.audioElement.srcObject = null
        conn.audioContext?.close()
      }
      peerConnectionsRef.current.clear()

      // Clear speaking interval
      if (speakingIntervalRef.current) {
        clearInterval(speakingIntervalRef.current)
        speakingIntervalRef.current = null
      }
    }
  }, [])

  return {
    isMuted,
    toggleMute,
    speakingUsers,
    audioEnabled,
    error,
    onRtcOffer,
    onRtcAnswer,
    onRtcIceCandidate,
  }
}
