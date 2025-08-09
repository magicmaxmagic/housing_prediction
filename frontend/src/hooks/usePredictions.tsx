import { useState, useCallback } from 'react';

export interface PredictionResult {
  zone_id: string;
  predicted_price: number; // total price in CAD
  predicted_rent: number; // monthly rent in CAD
  price_confidence_min: number;
  price_confidence_max: number;
  rent_confidence_min: number;
  rent_confidence_max: number;
  model_version?: string;
  prediction_date?: string;
}

export interface ZonePrediction extends PredictionResult {
  zone_name: string;
  current_avg_price: number;
  current_avg_rent: number;
  price_change_percent: number;
  rent_change_percent: number;
  investment_score: number;
}

export interface PredictionSummary {
  total_zones: number;
  avg_predicted_price: number;
  avg_predicted_rent: number;
  avg_investment_score: number;
  top_zones_by_price: ZonePrediction[];
  top_zones_by_rent: ZonePrediction[];
  top_zones_by_growth: ZonePrediction[];
}

export interface CustomPredictionParams {
  zone_id: string;
  property_size?: number;
  property_type?: string;
  year_built?: number;
  condition?: string;
  proximity_to_metro?: number;
  neighborhood_safety_score?: number;
}

interface UsePredictionsReturn {
  predictions: ZonePrediction[];
  summary: PredictionSummary | null;
  isLoading: boolean;
  error: string | null;
  loadPredictions: () => Promise<void>;
  loadZonePrediction: (zoneId: string) => Promise<ZonePrediction | null>;
  loadSummary: () => Promise<void>;
  customPrediction: (params: CustomPredictionParams) => Promise<PredictionResult | null>;
}

export const usePredictions = (): UsePredictionsReturn => {
  const [predictions, setPredictions] = useState<ZonePrediction[]>([]);
  const [summary, setSummary] = useState<PredictionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = '/api';

  // Generic API call handler
  const apiCall = async <T,>(url: string, options?: RequestInit): Promise<T | null> => {
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers
        },
        ...options
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error occurred';
      setError(errorMessage);
      console.error('API call error:', err);
      return null;
    }
  };

  // Load all predictions
  const loadPredictions = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    // Backend returns { data: [...] }
    const data = await apiCall<{ data: any[] }>(`${API_BASE}/predictions`);
    
    if (data && Array.isArray(data.data)) {
      const mapped: ZonePrediction[] = data.data.map((row: any) => ({
        zone_id: row.zone_id,
        zone_name: row.street_name || row.zone_id,
        predicted_price: Math.round(parseFloat(row.price_per_m2_prediction || 0) * 70),
        predicted_rent: Math.round(parseFloat(row.rent_prediction || 0)),
        price_confidence_min: Math.round(parseFloat(row.price_confidence_lower || 0) * 70),
        price_confidence_max: Math.round(parseFloat(row.price_confidence_upper || 0) * 70),
        rent_confidence_min: Math.round(parseFloat(row.rent_confidence_lower || 0)),
        rent_confidence_max: Math.round(parseFloat(row.rent_confidence_upper || 0)),
        current_avg_price: 0,
        current_avg_rent: 0,
        price_change_percent: 0,
        rent_change_percent: 0,
        investment_score: row.investment_score ? parseFloat(row.investment_score) : 0,
        model_version: row.model_version,
        prediction_date: row.created_at
      }));
      setPredictions(mapped);
    }
    
    setIsLoading(false);
  }, []);

  // Load prediction for specific zone
  const loadZonePrediction = useCallback(async (zoneId: string): Promise<ZonePrediction | null> => {
    setError(null);

    const data = await apiCall<any>(`${API_BASE}/predictions/zones/${zoneId}`);
    if (!data) return null;
    const cp = data.current_prediction;
    const zone = data.zone;
    const mapped: ZonePrediction = {
      zone_id: zone.zone_id,
      zone_name: zone.street_name || zone.zone_id,
      predicted_price: Math.round(parseFloat(cp?.price_per_m2?.prediction || 0) * 70),
      predicted_rent: Math.round(parseFloat(cp?.monthly_rent?.prediction || 0)),
      price_confidence_min: Math.round(parseFloat(cp?.price_per_m2?.confidence_lower || 0) * 70),
      price_confidence_max: Math.round(parseFloat(cp?.price_per_m2?.confidence_upper || 0) * 70),
      rent_confidence_min: Math.round(parseFloat(cp?.monthly_rent?.confidence_lower || 0)),
      rent_confidence_max: Math.round(parseFloat(cp?.monthly_rent?.confidence_upper || 0)),
      current_avg_price: 0,
      current_avg_rent: 0,
      price_change_percent: 0,
      rent_change_percent: 0,
      investment_score: zone.investment_score ? parseFloat(zone.investment_score) : 0,
      model_version: cp?.model_version,
      prediction_date: cp?.created_at
    };
    return mapped;
  }, []);

  // Load prediction summary
  const loadSummary = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    const data = await apiCall<any>(`${API_BASE}/predictions/summary`);
    
    if (data && data.summary) {
      const top = Array.isArray(data.top_zones) ? data.top_zones : [];
      const avgScoreVals = top
        .map((z: any) => (z.investment_score != null ? parseFloat(z.investment_score) : null))
        .filter((v: number | null) => v != null) as number[];
      const avgScore = avgScoreVals.length
        ? avgScoreVals.reduce((a: number, b: number) => a + b, 0) / avgScoreVals.length
        : 0;

      const mapped: PredictionSummary = {
        total_zones: parseInt(data.summary.total_zones_predicted || 0),
        avg_predicted_price: Math.round(parseFloat(data.summary.price_statistics?.average_price_per_m2 || 0) * 70),
        avg_predicted_rent: Math.round(parseFloat(data.summary.rent_statistics?.average_monthly_rent || 0)),
        avg_investment_score: avgScore,
        top_zones_by_price: top.slice(0, 5).map((z: any) => ({
          zone_id: z.zone_id,
          zone_name: z.zone_id,
          predicted_price: Math.round(parseFloat(z.predicted_price_per_m2 || 0) * 70),
          predicted_rent: Math.round(parseFloat(z.predicted_monthly_rent || 0)),
          price_confidence_min: 0,
          price_confidence_max: 0,
          rent_confidence_min: 0,
          rent_confidence_max: 0,
          current_avg_price: 0,
          current_avg_rent: 0,
          price_change_percent: 0,
          rent_change_percent: 0,
          investment_score: z.investment_score ? parseFloat(z.investment_score) : 0,
          model_version: undefined,
          prediction_date: data.generated_at
        })),
        top_zones_by_rent: top.slice(0, 5).map((z: any) => ({
          zone_id: z.zone_id,
          zone_name: z.zone_id,
          predicted_price: Math.round(parseFloat(z.predicted_price_per_m2 || 0) * 70),
          predicted_rent: Math.round(parseFloat(z.predicted_monthly_rent || 0)),
          price_confidence_min: 0,
          price_confidence_max: 0,
          rent_confidence_min: 0,
          rent_confidence_max: 0,
          current_avg_price: 0,
          current_avg_rent: 0,
          price_change_percent: 0,
          rent_change_percent: 0,
          investment_score: z.investment_score ? parseFloat(z.investment_score) : 0,
          model_version: undefined,
          prediction_date: data.generated_at
        })),
        top_zones_by_growth: top.slice(0, 5).map((z: any) => ({
          zone_id: z.zone_id,
          zone_name: z.zone_id,
          predicted_price: Math.round(parseFloat(z.predicted_price_per_m2 || 0) * 70),
          predicted_rent: Math.round(parseFloat(z.predicted_monthly_rent || 0)),
          price_confidence_min: 0,
          price_confidence_max: 0,
          rent_confidence_min: 0,
          rent_confidence_max: 0,
          current_avg_price: 0,
          current_avg_rent: 0,
          price_change_percent: 0,
          rent_change_percent: 0,
          investment_score: z.investment_score ? parseFloat(z.investment_score) : 0,
          model_version: undefined,
          prediction_date: data.generated_at
        }))
      };
      setSummary(mapped);
    }
    
    setIsLoading(false);
  }, []);

  // Make custom prediction
  const customPrediction = useCallback(async (params: CustomPredictionParams): Promise<PredictionResult | null> => {
    setError(null);

    // Map form params to backend expected fields
    const sizeSqft = params.property_size || 900;
    const sizeM2 = sizeSqft * 0.092903;
    const payload = {
      superficie_terrain: Math.round(sizeM2 * 1.4),
      superficie_batiment: Math.round(sizeM2),
      nb_logements: 1,
      annee_construction: params.year_built || 2005
    };

    const data = await apiCall<any>(`${API_BASE}/predictions/custom`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (!data || !data.predictions) return null;
    const pricePerM2 = parseFloat(data.predictions.price_per_m2?.prediction || 0);
    const priceLowerPerM2 = parseFloat(data.predictions.price_per_m2?.confidence_lower || 0);
    const priceUpperPerM2 = parseFloat(data.predictions.price_per_m2?.confidence_upper || 0);
    const rent = parseFloat(data.predictions.monthly_rent?.prediction || 0);
    const rentLower = parseFloat(data.predictions.monthly_rent?.confidence_lower || 0);
    const rentUpper = parseFloat(data.predictions.monthly_rent?.confidence_upper || 0);

    const result: PredictionResult = {
      zone_id: params.zone_id,
      predicted_price: Math.round(pricePerM2 * sizeM2),
      price_confidence_min: Math.round(priceLowerPerM2 * sizeM2),
      price_confidence_max: Math.round(priceUpperPerM2 * sizeM2),
      predicted_rent: Math.round(rent),
      rent_confidence_min: Math.round(rentLower),
      rent_confidence_max: Math.round(rentUpper),
      model_version: data.model_version,
      prediction_date: data.generated_at
    };

    return result;
  }, []);

  return {
    predictions,
    summary,
    isLoading,
    error,
    loadPredictions,
    loadZonePrediction,
    loadSummary,
    customPrediction
  };
};

// Utility functions for prediction data
export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);
};

export const formatPricePerSqft = (pricePerSqft: number): string => {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(pricePerSqft) + '/sq ft';
};

export const formatPercentage = (percentage: number): string => {
  const sign = percentage >= 0 ? '+' : '';
  return `${sign}${percentage.toFixed(1)}%`;
};

export const getConfidenceRange = (min: number, max: number): string => {
  return `${formatPrice(min)} - ${formatPrice(max)}`;
};

export const getPredictionAccuracy = (confidence_min: number, confidence_max: number, predicted: number): number => {
  const range = confidence_max - confidence_min;
  const rangePercent = (range / predicted) * 100;
  return Math.max(0, 100 - rangePercent);
};

export const getInvestmentRecommendation = (
  priceChangePercent: number, 
  rentChangePercent: number, 
  investmentScore: number
): { level: 'high' | 'medium' | 'low'; message: string } => {
  if (investmentScore >= 80 && priceChangePercent > 10 && rentChangePercent > 5) {
    return {
      level: 'high',
      message: 'Excellent investment opportunity with strong growth potential'
    };
  } else if (investmentScore >= 60 && (priceChangePercent > 5 || rentChangePercent > 3)) {
    return {
      level: 'medium',
      message: 'Good investment potential with moderate growth expected'
    };
  } else {
    return {
      level: 'low',
      message: 'Conservative investment with limited growth potential'
    };
  }
};

export default usePredictions;
