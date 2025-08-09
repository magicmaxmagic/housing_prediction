export interface AreaData {
  id: string;
  name: string;
  district: string;
  latitude: number;
  longitude: number;
  geometry: GeoJSON.Polygon;
  score: number;
  scoreDetails: ScoreDetails;
  forecast?: ForecastData;
  s_total: number;
  s_growth: number;
  s_supply: number;
  s_tension: number;
  s_access: number;
  s_return: number;
  as_of: string;
}

export interface ScoreDetails {
  growth: number;
  supply: number;
  tension: number;
  access: number;
  return: number;
}

export interface ScoringWeights {
  growth: number;
  supply: number;
  tension: number;
  access: number;
  return: number;
}

export interface ScoreWeights {
  growth: number;
  supply: number;
  tension: number;
  access: number;
  return: number;
}

export interface ForecastData {
  averagePrice: number;
  priceGrowth: number;
  rentalYield: number;
  marketTrend: 'bullish' | 'bearish' | 'stable';
  confidence: number;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}
