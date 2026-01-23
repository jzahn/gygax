export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  services: {
    api: {
      status: 'up' | 'down'
      responseTime: number
    }
    database: {
      status: 'up' | 'down'
      responseTime: number
      error: string | null
    }
  }
}

// Auth types
export interface User {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  emailVerified: boolean
  createdAt: string
}

export interface AuthResponse {
  user: User
}

export interface RegisterRequest {
  email: string
  password: string
  name: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LogoutResponse {
  success: boolean
}

export interface AuthError {
  error: string
  message: string
}

// Email verification types
export interface VerifyEmailRequest {
  token: string
}

export interface ForgotPasswordRequest {
  email: string
}

export interface ResetPasswordRequest {
  token: string
  password: string
}

export interface MessageResponse {
  success: boolean
  message: string
}

// Campaign types
export interface Campaign {
  id: string
  name: string
  description: string | null
  coverImageUrl: string | null
  coverImageFocusX: number | null
  coverImageFocusY: number | null
  createdAt: string
  updatedAt: string
}

export interface CampaignListResponse {
  campaigns: Campaign[]
}

export interface CampaignResponse {
  campaign: Campaign
}

export interface CreateCampaignRequest {
  name: string
  description?: string
}

export interface UpdateCampaignRequest {
  name?: string
  description?: string | null
}

// Map types
export type GridType = 'SQUARE' | 'HEX'

export interface Map {
  id: string
  name: string
  description: string | null
  gridType: GridType
  width: number
  height: number
  cellSize: number
  campaignId: string
  createdAt: string
  updatedAt: string
}

export interface MapListResponse {
  maps: Map[]
}

export interface MapResponse {
  map: Map
}

export interface CreateMapRequest {
  name: string
  description?: string
  gridType?: GridType
  width?: number
  height?: number
}

export interface UpdateMapRequest {
  name?: string
  description?: string
  width?: number
  height?: number
}
