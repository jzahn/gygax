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

// Campaign types (collection of Adventures)
export interface Campaign {
  id: string
  name: string
  description: string | null
  bannerImageUrl: string | null
  bannerHotspotX: number | null
  bannerHotspotY: number | null
  createdAt: string
  updatedAt: string
}

export interface CampaignWithAdventures extends Campaign {
  adventures: Adventure[]
  worldMap: Map | null
}

export interface CampaignListItem extends Campaign {
  adventureCount: number
}

export interface CampaignListResponse {
  campaigns: CampaignListItem[]
}

export interface CampaignResponse {
  campaign: Campaign
}

export interface CampaignWithAdventuresResponse {
  campaign: CampaignWithAdventures
}

export interface CreateCampaignRequest {
  name: string
  description?: string
}

export interface UpdateCampaignRequest {
  name?: string
  description?: string | null
}

export interface CreateWorldMapRequest {
  name: string
  description?: string
  gridType?: GridType
  width?: number
  height?: number
  content?: MapContent
}

// Adventure types (individual adventure, may belong to a Campaign)
export interface Adventure {
  id: string
  name: string
  description: string | null
  coverImageUrl: string | null
  coverImageFocusX: number | null
  coverImageFocusY: number | null
  campaignId: string | null
  createdAt: string
  updatedAt: string
}

export interface AdventureListResponse {
  adventures: Adventure[]
}

export interface AdventureResponse {
  adventure: Adventure
}

export interface CreateAdventureRequest {
  name: string
  description?: string
  campaignId?: string
}

export interface UpdateAdventureRequest {
  name?: string
  description?: string | null
  campaignId?: string | null
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
  adventureId: string | null
  campaignId: string | null
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
  content?: MapContent  // For import
}

export interface UpdateMapRequest {
  name?: string
  description?: string
  width?: number
  height?: number
  content?: MapContent
}

// Map export file format
export interface MapExportFile {
  version: 1
  exportedAt: string
  map: {
    name: string
    description: string | null
    gridType: GridType
    width: number
    height: number
    cellSize: number
    content: MapContent | null
  }
}

// Character types (B/X D&D)
export type CharacterClass =
  | 'Fighter'
  | 'Magic-User'
  | 'Cleric'
  | 'Thief'
  | 'Elf'
  | 'Dwarf'
  | 'Halfling'

export type Alignment = 'Lawful' | 'Neutral' | 'Chaotic'

export interface Character {
  id: string
  name: string
  class: CharacterClass
  level: number
  alignment: Alignment | null
  title: string | null

  // Ability Scores
  strength: number
  intelligence: number
  wisdom: number
  dexterity: number
  constitution: number
  charisma: number

  // Combat
  hitPointsMax: number
  hitPointsCurrent: number
  armorClass: number

  // Saving Throws
  saveDeathRay: number
  saveWands: number
  saveParalysis: number
  saveBreath: number
  saveSpells: number

  // Resources
  experiencePoints: number
  goldPieces: number

  // Freeform text
  equipment: string | null
  spells: string | null
  notes: string | null

  // Avatar
  avatarUrl: string | null

  createdAt: string
  updatedAt: string
}

export interface CharacterListResponse {
  characters: Character[]
}

export interface CharacterResponse {
  character: Character
}

export interface CreateCharacterRequest {
  name: string
  class: CharacterClass
  strength?: number
  intelligence?: number
  wisdom?: number
  dexterity?: number
  constitution?: number
  charisma?: number
}

export interface UpdateCharacterRequest {
  name?: string
  class?: CharacterClass
  level?: number
  alignment?: Alignment | null
  title?: string | null
  strength?: number
  intelligence?: number
  wisdom?: number
  dexterity?: number
  constitution?: number
  charisma?: number
  hitPointsMax?: number
  hitPointsCurrent?: number
  armorClass?: number
  saveDeathRay?: number
  saveWands?: number
  saveParalysis?: number
  saveBreath?: number
  saveSpells?: number
  experiencePoints?: number
  goldPieces?: number
  equipment?: string | null
  spells?: string | null
  notes?: string | null
}

// NPC types (DM-owned characters in Adventures)
export interface NPC {
  id: string
  name: string
  description: string | null

  class: string | null  // Optional unlike Character
  level: number
  alignment: Alignment | null
  title: string | null

  // Ability Scores (all optional)
  strength: number | null
  intelligence: number | null
  wisdom: number | null
  dexterity: number | null
  constitution: number | null
  charisma: number | null

  // Combat
  hitPointsMax: number | null
  hitPointsCurrent: number | null
  armorClass: number | null

  // Saving Throws
  saveDeathRay: number | null
  saveWands: number | null
  saveParalysis: number | null
  saveBreath: number | null
  saveSpells: number | null

  // Resources
  experiencePoints: number | null
  goldPieces: number | null

  // Freeform text
  equipment: string | null
  spells: string | null
  notes: string | null

  // Avatar
  avatarUrl: string | null

  adventureId: string
  createdAt: string
  updatedAt: string
}

// Abbreviated NPC for list views
export interface NPCListItem {
  id: string
  name: string
  description: string | null
  class: string | null
  level: number
  avatarUrl: string | null
  adventureId: string
  createdAt: string
  updatedAt: string
}

export interface NPCListResponse {
  npcs: NPCListItem[]
}

export interface NPCResponse {
  npc: NPC
}

export interface CreateNPCRequest {
  name: string
  description?: string
  class?: string
  level?: number
  alignment?: Alignment
  title?: string
  strength?: number
  intelligence?: number
  wisdom?: number
  dexterity?: number
  constitution?: number
  charisma?: number
  // Extended fields for import support
  hitPointsMax?: number
  hitPointsCurrent?: number
  armorClass?: number
  saveDeathRay?: number
  saveWands?: number
  saveParalysis?: number
  saveBreath?: number
  saveSpells?: number
  experiencePoints?: number
  goldPieces?: number
  equipment?: string
  spells?: string
  notes?: string
}

export interface UpdateNPCRequest {
  name?: string
  description?: string | null
  class?: string | null
  level?: number
  alignment?: Alignment | null
  title?: string | null
  strength?: number | null
  intelligence?: number | null
  wisdom?: number | null
  dexterity?: number | null
  constitution?: number | null
  charisma?: number | null
  hitPointsMax?: number | null
  hitPointsCurrent?: number | null
  armorClass?: number | null
  saveDeathRay?: number | null
  saveWands?: number | null
  saveParalysis?: number | null
  saveBreath?: number | null
  saveSpells?: number | null
  experiencePoints?: number | null
  goldPieces?: number | null
  equipment?: string | null
  spells?: string | null
  notes?: string | null
}

// Backdrop types
export interface Backdrop {
  id: string
  name: string
  description: string | null
  imageUrl: string
  focusX: number
  focusY: number
  adventureId: string
  createdAt: string
  updatedAt: string
}

export interface BackdropListResponse {
  backdrops: Backdrop[]
}

export interface BackdropResponse {
  backdrop: Backdrop
}

export interface UpdateBackdropRequest {
  name?: string
  description?: string | null
  focusX?: number
  focusY?: number
}

// Note types
export interface Note {
  id: string
  title: string
  content: string | null
  adventureId: string
  createdAt: string
  updatedAt: string
}

export interface NoteListResponse {
  notes: Note[]
}

export interface NoteResponse {
  note: Note
}

export interface CreateNoteRequest {
  title: string
  content?: string
}

export interface UpdateNoteRequest {
  title?: string
  content?: string | null
}

// NPC export file format
export interface NPCExportFile {
  version: 1
  exportedAt: string
  npc: {
    name: string
    description: string | null
    class: string | null
    level: number
    alignment: string | null
    title: string | null
    strength: number | null
    intelligence: number | null
    wisdom: number | null
    dexterity: number | null
    constitution: number | null
    charisma: number | null
    hitPointsMax: number | null
    hitPointsCurrent: number | null
    armorClass: number | null
    saveDeathRay: number | null
    saveWands: number | null
    saveParalysis: number | null
    saveBreath: number | null
    saveSpells: number | null
    experiencePoints: number | null
    goldPieces: number | null
    equipment: string | null
    spells: string | null
    notes: string | null
  }
}

// Session types
export type SessionStatus = 'FORMING' | 'ACTIVE' | 'PAUSED' | 'ENDED'
export type SessionAccessType = 'OPEN' | 'CAMPAIGN' | 'INVITE'

export interface Session {
  id: string
  status: SessionStatus
  accessType: SessionAccessType
  adventureId: string
  dmId: string
  activeMapId: string | null
  activeBackdropId: string | null
  createdAt: string
  updatedAt: string
  startedAt: string | null
  pausedAt: string | null
  endedAt: string | null
}

export interface SessionWithDetails extends Session {
  adventure: {
    id: string
    name: string
    campaignId: string | null
  }
  dm: {
    id: string
    name: string
    avatarUrl: string | null
  }
  participants: SessionParticipantWithDetails[]
  invites: SessionInviteWithDetails[]
}

export interface SessionListItem {
  id: string
  status: SessionStatus
  accessType: SessionAccessType
  adventureId: string
  createdAt: string
  adventure: {
    id: string
    name: string
  }
  dm: {
    id: string
    name: string
    avatarUrl: string | null
  }
  participantCount: number
}

export interface SessionParticipant {
  id: string
  sessionId: string
  userId: string
  characterId: string
  joinedAt: string
  leftAt: string | null
}

export interface SessionParticipantWithDetails extends SessionParticipant {
  user: {
    id: string
    name: string
    avatarUrl: string | null
  }
  character: {
    id: string
    name: string
    class: CharacterClass
    level: number
    hitPointsCurrent: number
    hitPointsMax: number
    armorClass: number
    avatarUrl: string | null
  }
}

// Campaign Membership types
export interface CampaignMember {
  id: string
  campaignId: string
  userId: string
  joinedAt: string
}

export interface CampaignMemberWithDetails extends CampaignMember {
  user: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  }
}

export interface CampaignMembersResponse {
  members: CampaignMemberWithDetails[]
}

export interface CampaignMemberResponse {
  member: CampaignMemberWithDetails
}

export interface AddCampaignMemberRequest {
  email?: string
  userId?: string
}

// Session Invite types
export interface SessionInvite {
  id: string
  sessionId: string
  userId: string | null
  email: string | null
  createdAt: string
  acceptedAt: string | null
  declinedAt: string | null
}

export interface SessionInviteWithDetails extends SessionInvite {
  user: {
    id: string
    name: string
    email: string
  } | null
}

export interface SessionInvitesResponse {
  invites: SessionInviteWithDetails[]
}

export interface SessionInviteResponse {
  invite: SessionInviteWithDetails
}

export interface CreateSessionInviteRequest {
  email?: string
  userId?: string
}

export interface CreateSessionRequest {
  accessType?: SessionAccessType
}

export interface SessionListResponse {
  sessions: SessionListItem[]
}

export interface SessionResponse {
  session: SessionWithDetails
}

export interface JoinSessionRequest {
  characterId: string
}

export interface SessionParticipantResponse {
  participant: SessionParticipantWithDetails
}

export interface UpdateSessionRequest {
  status?: SessionStatus
}

export interface WSTokenResponse {
  token: string
}

// WebSocket message types
export interface WSMessage<T = unknown> {
  type: string
  payload: T
}

export interface WSSessionState {
  session: SessionWithDetails
  connectedUsers: WSConnectedUser[]
}

export interface WSConnectedUser {
  userId: string
  userName: string
  avatarUrl: string | null
  role: 'dm' | 'player'
  characterId?: string
  characterName?: string
}

export interface WSUserConnected {
  userId: string
  userName: string
  avatarUrl: string | null
  role: 'dm' | 'player'
  characterId?: string
  characterName?: string
}

export interface WSUserDisconnected {
  userId: string
}

export interface WSSessionUpdated {
  status: SessionStatus
  activeMapId: string | null
  activeBackdropId: string | null
  pausedAt: string | null
  endedAt: string | null
}

export interface WSParticipantJoined {
  participant: SessionParticipantWithDetails
}

export interface WSParticipantLeft {
  userId: string
}

export interface WSError {
  message: string
}

// WebSocket messages for 011b: Map/Backdrop switching (DM → Server)
export interface WSSetMap {
  mapId: string | null
}

export interface WSSetBackdrop {
  backdropId: string | null
}

// WebSocket messages for 011b: WebRTC signaling
export interface WSRtcOffer {
  targetUserId: string
  sdp: RTCSessionDescriptionInit
}

export interface WSRtcAnswer {
  targetUserId: string
  sdp: RTCSessionDescriptionInit
}

export interface WSRtcIceCandidate {
  targetUserId: string
  candidate: RTCIceCandidateInit
}

export interface WSRtcMuteState {
  muted: boolean
}

// Relayed versions (server adds fromUserId)
export interface WSRtcOfferRelayed {
  fromUserId: string
  sdp: RTCSessionDescriptionInit
}

export interface WSRtcAnswerRelayed {
  fromUserId: string
  sdp: RTCSessionDescriptionInit
}

export interface WSRtcIceCandidateRelayed {
  fromUserId: string
  candidate: RTCIceCandidateInit
}

export interface WSRtcMuteStateRelayed {
  userId: string
  muted: boolean
}

// Chat types

export interface ChatChannelParticipant {
  id: string
  name: string
  avatarUrl: string | null
}

export interface ChatChannel {
  id: string
  name: string | null // null for 1:1 channels
  isMain: boolean
  participants: ChatChannelParticipant[]
  unreadCount: number
  lastMessage?: {
    content: string
    senderName: string
    createdAt: string
  }
}

export interface ChatChannelListResponse {
  channels: ChatChannel[]
}

export interface CreateChatChannelRequest {
  participantIds: string[]
  name?: string
}

export interface ChatChannelResponse {
  channel: ChatChannel
}

export type ChatMessageType = 'TEXT' | 'ROLL' | 'SYSTEM'

export interface ChatMessage {
  id: string
  content: string
  type: ChatMessageType
  createdAt: string
  channelId: string
  sender: {
    id: string
    name: string
    avatarUrl: string | null
  }
  diceExpression?: string
  diceRolls?: number[]
  diceTotal?: number
  diceModifier?: number
}

export interface ChatMessageListResponse {
  messages: ChatMessage[]
  hasMore: boolean
}

export interface SendChatMessage {
  channelId: string
  content: string
}

// Dice types (re-exported from dice.ts for convenience)
export interface DiceExpression {
  count: number
  sides: number
  modifier: number
  raw: string
}

export interface DiceResult {
  expression: DiceExpression
  rolls: number[]
  total: number
}

// WebSocket Chat messages

// Client → Server
export interface WSChatMessage {
  channelId: string
  content: string
}

export interface WSChatCreateChannel {
  participantIds: string[]
  name?: string
}

export interface WSChatMarkRead {
  channelId: string
}

// Server → Client
export interface WSChatMessageReceived {
  channelId: string
  message: ChatMessage
}

export interface WSChatChannels {
  channels: ChatChannel[]
}

export interface WSChatChannelCreated {
  channel: ChatChannel
}

export interface WSChatHistory {
  channelId: string
  messages: ChatMessage[]
  hasMore: boolean
}

// ============================================
// Fog of War & Token types (011d)
// ============================================

// Cell coordinate (supports both square and hex grids)
export interface CellCoord {
  col?: number  // Square grid
  row?: number
  q?: number    // Hex grid (axial)
  r?: number
}

// Fog state for a map in a session
export interface FogState {
  mapId: string
  revealedCells: CellCoord[]
}

// Token types
export type SessionTokenType = 'PC' | 'NPC' | 'MONSTER'

export interface SessionToken {
  id: string
  sessionId: string
  mapId: string
  type: SessionTokenType
  name: string
  position: CellCoord
  imageUrl?: string
  characterId?: string
  npcId?: string
  color: string
}

// Token colors by type
export const TOKEN_COLORS: Record<SessionTokenType, string> = {
  PC: '#22c55e',      // green-500
  NPC: '#3b82f6',     // blue-500
  MONSTER: '#ef4444', // red-500
}

// REST API responses
export interface FogStateResponse {
  revealedCells: CellCoord[]
}

export interface TokenListResponse {
  tokens: SessionToken[]
}

// WebSocket payloads: Client → Server

export interface WSFogReveal {
  mapId: string
  cells: CellCoord[]
}

export interface WSFogRevealAll {
  mapId: string
}

export interface WSFogHideAll {
  mapId: string
}

export interface WSTokenPlace {
  mapId: string
  type: SessionTokenType
  name: string
  position: CellCoord
  characterId?: string
  npcId?: string
  color?: string
  imageUrl?: string
}

export interface WSTokenMove {
  tokenId: string
  position: CellCoord
}

export interface WSTokenRemove {
  tokenId: string
}

// WebSocket payloads: Server → Client

export interface WSFogState {
  mapId: string
  revealedCells: CellCoord[]
}

export interface WSFogUpdated {
  mapId: string
  newlyRevealed: CellCoord[]
}

export interface WSTokenState {
  mapId: string
  tokens: SessionToken[]
}

export interface WSTokenPlaced {
  token: SessionToken
}

export interface WSTokenMoved {
  tokenId: string
  position: CellCoord
}

export interface WSTokenRemoved {
  tokenId: string
}
