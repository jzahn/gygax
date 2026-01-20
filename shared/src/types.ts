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
