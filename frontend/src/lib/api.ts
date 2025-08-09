// Base API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

// Type definitions
export interface AreaData {
  id: string
  name: string
  score: number
  quantile: number
  last_updated: string
  scores?: {
    growth: number
    supply: number
    tension: number
    accessibility: number
    returns: number
    total: number
  }
}

export interface ScoringWeights {
  growth: number
  supply: number
  tension: number
  accessibility: number
  returns: number
}

export interface DetailedScores {
  area_id: string
  name: string
  as_of: string
  scores: {
    growth: number
    supply: number
    tension: number
    accessibility: number
    returns: number
    total: number
  }
  weights: ScoringWeights
  metadata?: {
    using_custom_weights: boolean
    original_total: number
    calculation_method: string
  }
}

export interface ForecastData {
  area_id: string
  metric: string
  horizon: number
  current_value: number
  forecast: {
    month: string
    yhat: number
    yhat_lower: number
    yhat_upper: number
  }[]
  confidence: number
  model_type: string
  last_updated: string
}

export interface AreasResponse {
  type: 'FeatureCollection'
  features: {
    type: 'Feature'
    id: string
    properties: AreaData
    geometry: any
  }[]
  metadata: {
    total: number
    metric: string
    as_of: string
    bbox?: string
  }
}

// API client class
export class InvestMTLAPI {
  private baseUrl: string
  private cache: Map<string, { data: any; timestamp: number }> = new Map()
  private cacheTimeout = 5 * 60 * 1000 // 5 minutes

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
  }

  private async fetchWithCache<T>(url: string, cacheKey: string): Promise<T> {
    // Check cache first
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data
    }

    try {
      const response = await fetch(`${this.baseUrl}${url}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      // Cache the result
      this.cache.set(cacheKey, { data, timestamp: Date.now() })
      
      return data
    } catch (error) {
      console.error(`API error for ${url}:`, error)
      
      // Return cached data if available, even if stale
      if (cached) {
        return cached.data
      }
      
      throw error
    }
  }

  async getAreas(options: {
    bbox?: string
    limit?: number
    geometry?: boolean
  } = {}): Promise<AreasResponse> {
    const params = new URLSearchParams()
    
    if (options.bbox) params.append('bbox', options.bbox)
    if (options.limit) params.append('limit', options.limit.toString())
    if (options.geometry) params.append('geometry', 'true')

    const url = `/areas?${params.toString()}`
    const cacheKey = `areas_${params.toString()}`
    
    return this.fetchWithCache<AreasResponse>(url, cacheKey)
  }

  async getAreaScores(
    areaId: string, 
    weights?: ScoringWeights,
    asOf?: string
  ): Promise<DetailedScores> {
    const params = new URLSearchParams()
    
    if (asOf) params.append('asOf', asOf)
    
    if (weights) {
      params.append('w_growth', weights.growth.toString())
      params.append('w_supply', weights.supply.toString())
      params.append('w_tension', weights.tension.toString())
      params.append('w_accessibility', weights.accessibility.toString())
      params.append('w_returns', weights.returns.toString())
    }

    const url = `/scores/${areaId}?${params.toString()}`
    const cacheKey = `scores_${areaId}_${params.toString()}`
    
    return this.fetchWithCache<DetailedScores>(url, cacheKey)
  }

  async getForecast(
    metric: string,
    areaId: string,
    horizon: number = 12
  ): Promise<ForecastData> {
    const url = `/forecast/${metric}/${areaId}?h=${horizon}`
    const cacheKey = `forecast_${metric}_${areaId}_${horizon}`
    
    return this.fetchWithCache<ForecastData>(url, cacheKey)
  }

  async compareAreas(areaIds: string[], asOf?: string): Promise<{
    comparison: DetailedScores[]
    statistics: {
      count: number
      highest_score: number
      lowest_score: number
      average_score: number
    }
  }> {
    const params = new URLSearchParams()
    params.append('areas', areaIds.join(','))
    if (asOf) params.append('asOf', asOf)

    const url = `/scores/compare?${params.toString()}`
    const cacheKey = `compare_${areaIds.join('_')}_${asOf || 'latest'}`
    
    return this.fetchWithCache(url, cacheKey)
  }

  async getTopAreas(limit: number = 10): Promise<{
    top_areas: AreaData[]
    metadata: {
      limit: number
      returned: number
      as_of: string
    }
  }> {
    const url = `/scores/top?limit=${limit}`
    const cacheKey = `top_areas_${limit}`
    
    return this.fetchWithCache(url, cacheKey)
  }

  async getAvailableMetrics(): Promise<{
    available_metrics: {
      metric: string
      forecasts_available?: number
      description: string
      unit?: string
      frequency?: string
    }[]
  }> {
    const url = '/forecast/metrics'
    const cacheKey = 'available_metrics'
    
    return this.fetchWithCache(url, cacheKey)
  }

  clearCache(): void {
    this.cache.clear()
  }

  setCacheTimeout(timeout: number): void {
    this.cacheTimeout = timeout
  }
}

// Default API instance
export const api = new InvestMTLAPI()

// Utility functions
export function calculateWeightedScore(
  scores: { [key: string]: number }, 
  weights: ScoringWeights
): number {
  const total = (
    scores.growth * weights.growth +
    scores.supply * weights.supply +
    scores.tension * weights.tension +
    scores.accessibility * weights.accessibility +
    scores.returns * weights.returns
  )
  
  return Math.round(total * 10) / 10
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-lime-600'
  if (score >= 40) return 'text-yellow-600'
  if (score >= 20) return 'text-orange-600'
  return 'text-red-600'
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Very Good'
  if (score >= 40) return 'Good'
  if (score >= 20) return 'Fair'
  return 'Poor'
}

export function getQuantileColor(quantile: number): string {
  const colors = {
    5: '#10b981', // green-500
    4: '#84cc16', // lime-500
    3: '#eab308', // yellow-500
    2: '#f97316', // orange-500
    1: '#ef4444'  // red-500
  }
  return colors[quantile as keyof typeof colors] || '#6b7280'
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`
}
