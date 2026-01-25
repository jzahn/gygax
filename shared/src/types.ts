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

// Wall cell (square grid only)
export interface WallCell {
  col: number
  row: number
}

// Dungeon feature types
export type FeatureType =
  // Doors (1x1, placed on wall edge)
  | 'door'           // Standard door
  | 'door-double'    // Double door (1x2 base)
  | 'door-secret'    // Secret door (S mark)
  | 'door-locked'    // Locked door
  // Stairs (1x2 or 2x2)
  | 'stairs-up'      // Stairs going up
  | 'stairs-down'    // Stairs going down
  // Objects (1x1)
  | 'pillar'         // Stone pillar
  | 'statue'         // Statue
  | 'altar'          // Altar/shrine
  | 'fountain'       // Fountain/well
  | 'chest'          // Treasure chest
  | 'throne'         // Throne
  // Hazards (1x1 or 1x2)
  | 'trap'           // Trap marker
  | 'pit'            // Pit/hole
  // Misc
  | 'lever'          // Lever/switch
  | 'fireplace'      // Fireplace (1x2)
  | 'table'          // Table (1x2 or 2x2)
  | 'bed'            // Bed (1x2)

// Feature size types
export type FeatureSize = '1x1' | '1x2' | '2x1' | '2x2'

// Feature type to size mapping
export const FEATURE_SIZES: Record<FeatureType, FeatureSize> = {
  'door': '1x1',
  'door-double': '1x2',
  'door-secret': '1x1',
  'door-locked': '1x1',
  'stairs-up': '1x2',
  'stairs-down': '1x2',
  'pillar': '1x1',
  'statue': '1x1',
  'altar': '1x1',
  'fountain': '1x1',
  'chest': '1x1',
  'throne': '1x1',
  'trap': '1x1',
  'pit': '1x1',
  'lever': '1x1',
  'fireplace': '1x2',
  'table': '2x2',
  'bed': '1x2',
}

// Dungeon feature stamp
export interface DungeonFeature {
  id: string
  type: FeatureType
  position: { col: number; row: number }  // Top-left cell of the feature
  rotation: 0 | 90 | 180 | 270  // Degrees clockwise
}

// Complete map drawing content
// Version 1: terrain only (backwards compatible)
// Version 2: terrain + paths + labels
// Version 3: adds walls + features for square grid maps
export interface MapContent {
  version: number
  terrain: TerrainStamp[]
  paths?: MapPath[]          // Optional for backwards compatibility
  labels?: MapLabel[]        // Optional for backwards compatibility
  walls?: WallCell[]         // Square grid maps only
  features?: DungeonFeature[] // Square grid maps only
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
