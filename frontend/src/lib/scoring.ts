import { ScoringWeights } from './api'
// Ensure ScoringWeights in './api' includes: growth, supply, tension, access, return

// Default scoring weights
export const DEFAULT_WEIGHTS: ScoringWeights = {
  growth: 0.25,
  supply: 0.20,
  tension: 0.20,
  access: 0.20,
  return: 0.15,
}

// Compute weighted score on the client side
export function computeWeightedScore(
  subscores: { [key: string]: number },
  weights: ScoringWeights = DEFAULT_WEIGHTS
): number {
  // Normalize weights to ensure they sum to 1
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0)
  const normalizedWeights = totalWeight > 0 
    ? Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, value / totalWeight]))
    : weights

  const weightedSum = (
    (subscores.growth || 0) * (normalizedWeights.growth || 0) +
    (subscores.supply || 0) * (normalizedWeights.supply || 0) +
    (subscores.tension || 0) * (normalizedWeights.tension || 0) +
    (subscores.access || 0) * (normalizedWeights.access || 0) +
    (subscores.return || 0) * (normalizedWeights.return || 0)
  )

  return Math.round(weightedSum * 10) / 10 // Round to 1 decimal place
}

// Robust scaler implementation (simplified)
export function robustScale(values: number[], newValue: number): number {
  if (values.length === 0) return 50 // Default middle score

  // Calculate median and IQR
  const sorted = [...values].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  
  const q1Index = Math.floor(sorted.length * 0.25)
  const q3Index = Math.floor(sorted.length * 0.75)
  const q1 = sorted[q1Index]
  const q3 = sorted[q3Index]
  const iqr = q3 - q1

  // Avoid division by zero
  if (iqr === 0) return 50

  // Scale to 0-100 range with robust scaling
  const scaled = ((newValue - median) / iqr) * 25 + 50 // Scale factor of 25 for reasonable spread
  
  // Clamp to 0-100 range
  return Math.max(0, Math.min(100, scaled))
}

// Calculate quantiles for score classification
export function calculateQuantiles(scores: number[]): { [key: number]: number } {
  if (scores.length === 0) return { 1: 0, 2: 25, 3: 50, 4: 75, 5: 100 }

  const sorted = [...scores].sort((a, b) => a - b)
  
  return {
    1: sorted[Math.floor(sorted.length * 0.2)], // Bottom 20%
    2: sorted[Math.floor(sorted.length * 0.4)], // 20-40%
    3: sorted[Math.floor(sorted.length * 0.6)], // 40-60%
    4: sorted[Math.floor(sorted.length * 0.8)], // 60-80%
    5: sorted[Math.floor(sorted.length * 0.95)], // Top 20%
  }
}

// Convert score to quantile
export function scoreToQuantile(score: number, quantileThresholds: { [key: number]: number }): number {
  if (score >= quantileThresholds[5]) return 5
  if (score >= quantileThresholds[4]) return 4
  if (score >= quantileThresholds[3]) return 3
  if (score >= quantileThresholds[2]) return 2
  return 1
}

// Validate weights sum to approximately 1
export function validateWeights(weights: ScoringWeights): boolean {
  const sum = Object.values(weights).reduce((total, weight) => total + weight, 0)
  return Math.abs(sum - 1.0) < 0.01 // Allow small floating point errors
}

// Normalize weights to sum to 1
export function normalizeWeights(weights: ScoringWeights): ScoringWeights {
  const sum = Object.values(weights).reduce((total, weight) => total + weight, 0)
  
  if (sum === 0) return DEFAULT_WEIGHTS
  
  return {
    growth: weights.growth / sum,
    supply: weights.supply / sum,
    tension: weights.tension / sum,
  access: weights.access / sum,
  return: weights.return / sum,
  }
}

// Score interpretation helpers
export function getScoreInterpretation(score: number): {
  label: string
  description: string
  color: string
  textColor: string
} {
  if (score >= 80) {
    return {
      label: 'Excellent',
      description: 'Outstanding investment potential',
      color: '#10b981',
      textColor: 'text-green-600'
    }
  }
  if (score >= 60) {
    return {
      label: 'Very Good',
      description: 'Strong investment potential',
      color: '#84cc16',
      textColor: 'text-lime-600'
    }
  }
  if (score >= 40) {
    return {
      label: 'Good',
      description: 'Moderate investment potential',
      color: '#eab308',
      textColor: 'text-yellow-600'
    }
  }
  if (score >= 20) {
    return {
      label: 'Fair',
      description: 'Limited investment potential',
      color: '#f97316',
      textColor: 'text-orange-600'
    }
  }
  return {
    label: 'Poor',
    description: 'Low investment potential',
    color: '#ef4444',
    textColor: 'text-red-600'
  }
}

// Component score descriptions
export const SCORE_DESCRIPTIONS = {
  growth: {
    name: 'Growth Potential',
    description: 'Population growth, economic development, and construction activity',
    high: 'Strong population and economic growth indicators',
    low: 'Limited growth indicators or declining trends'
  },
  supply: {
    name: 'Future Supply',
    description: 'Upcoming housing developments and construction permits',
    high: 'Limited new supply, favorable supply-demand balance', 
    low: 'High new supply may increase competition'
  },
  tension: {
    name: 'Market Tension',
    description: 'Rental vacancy rates and rent growth patterns',
    high: 'Low vacancy, strong rent growth, tight market',
    low: 'High vacancy, weak rent growth, loose market'
  },
  access: {
    name: 'Accessibility',
    description: 'Transit access and proximity to amenities',
    high: 'Excellent transit access and nearby amenities',
    low: 'Limited transit access, fewer amenities'
  },
  return: {
    name: 'Return Potential',
    description: 'Rental yield and capital appreciation potential',
    high: 'Strong rental yields and appreciation potential',
    low: 'Lower yields or limited appreciation potential'
  }
}

// Export utilities for chart data formatting
export function formatScoreForChart(scores: { [key: string]: number }, weights: ScoringWeights) {
  return Object.entries(scores).map(([key, value]) => ({
    category: SCORE_DESCRIPTIONS[key as keyof typeof SCORE_DESCRIPTIONS]?.name || key,
    score: value,
    weight: weights[key as keyof ScoringWeights] || 0,
    weightedScore: value * (weights[key as keyof ScoringWeights] || 0),
  }))
}
