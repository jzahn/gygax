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

// Hex coordinate (column, row)
export interface HexCoord {
  col: number
  row: number
}

// Natural terrain types
export type NaturalTerrain =
  | 'clear'
  | 'grasslands'
  | 'forest'
  | 'jungle'
  | 'hills'
  | 'mountains'
  | 'desert'
  | 'swamp'
  | 'water'
  | 'volcano'
  | 'barren'
  | 'caves'

// Settlement/POI types
export type SettlementTerrain =
  | 'castle'
  | 'ruins'
  | 'capitol'
  | 'city'
  | 'town'

export type TerrainType = NaturalTerrain | SettlementTerrain

// A terrain stamp applied to a hex
export interface TerrainStamp {
  hex: HexCoord
  terrain: TerrainType
  variant: 0 | 1 | 2  // Each terrain has 3 visual variants
}

// Path types
export type PathType = 'road' | 'river' | 'stream' | 'border' | 'trail'

// Point in map pixel coordinates
export interface MapPoint {
  x: number
  y: number
}

// A path element (road, river, border, trail)
export interface MapPath {
  id: string
  type: PathType
  points: MapPoint[]
  closed?: boolean  // For closed border regions (optional future use)
}

// Text label sizes
export type TextSize = 'small' | 'medium' | 'large' | 'xlarge'

// A text label
export interface MapLabel {
  id: string
  text: string
  position: MapPoint
  size: TextSize
}

// Complete map drawing content
// Version 1: terrain only (backwards compatible)
// Version 2: terrain + paths + labels
export interface MapContent {
  version: number
  terrain: TerrainStamp[]
  paths?: MapPath[]    // Optional for backwards compatibility
  labels?: MapLabel[]  // Optional for backwards compatibility
}

export interface Map {
  id: string
  name: string
  description: string | null
  gridType: GridType
  width: number
  height: number
  cellSize: number
  content: MapContent | null
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
  content?: MapContent
}
