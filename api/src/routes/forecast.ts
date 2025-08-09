import { Hono } from 'hono';
import { Env } from '../index';

export const forecastRoutes = new Hono<{ Bindings: Env }>();

// Helper function to get forecasts from R2 or D1
async function getForecastData(env: Env, metric: string, areaId: string, horizon?: number) {
  try {
    // Try to get from R2 first (full forecast data)
    const r2Object = await env.BUCKET.get('forecasts.json');
    
    if (r2Object) {
      const forecasts = await r2Object.json() as any;
      
      // Look for matching forecast
      for (const [key, forecast] of Object.entries(forecasts)) {
        const forecastData = forecast as any;
        
        // Match by metric and area (flexible matching)
        const matchesMetric = forecastData.metric === metric || key.includes(metric);
        const matchesArea = (
          forecastData.district === areaId ||
          forecastData.region === areaId ||
          key.includes(areaId.replace(' ', '_')) ||
          areaId.includes(forecastData.district) ||
          areaId.includes(forecastData.region)
        );
        
        if (matchesMetric && matchesArea) {
          return {
            ...forecastData,
            source: 'r2',
            key: key
          };
        }
      }
    }
    
    // Fallback to D1 query
    let query = `
      SELECT 
        area_id,
        metric,
        horizon,
        yhat,
        yhat_low,
        yhat_upper,
        as_of
      FROM forecasts
      WHERE area_id = ? AND metric = ?
      ORDER BY horizon ASC
    `;
    
    const params = [areaId, metric];
    
    if (horizon) {
      query += ` LIMIT ?`;
      params.push(horizon.toString());
    }
    
    const { results } = await env.DB.prepare(query).bind(...params).all();
    
    if (results && results.length > 0) {
      const forecastPoints = (results as any[]).map(row => ({
        month: new Date(Date.now() + row.horizon * 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 7),
        yhat: row.yhat,
        yhat_lower: row.yhat_low,
        yhat_upper: row.yhat_upper
      }));
      
      return {
        area_id: areaId,
        metric: metric,
        current_value: 0, // Would need to calculate from latest data
        forecast: forecastPoints,
        confidence: 0.7, // Default confidence
        model_type: 'database',
        source: 'd1'
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching forecast data:', error);
    return null;
  }
}

// GET /forecast/:metric/:areaId - Get forecast for specific metric and area
forecastRoutes.get('/:metric/:areaId', async (c) => {
  try {
    const metric = c.req.param('metric');
    const areaId = c.req.param('areaId');
    const horizon = parseInt(c.req.query('h') || '12');
    
    if (!metric || !areaId) {
      return c.json({
        error: {
          message: 'Metric and area ID are required',
          code: 'MISSING_PARAMETERS'
        }
      }, 400);
    }
    
    // Validate metric
    const validMetrics = ['rent', 'average_rent', 'vacancy_rate', 'housing_starts'];
    if (!validMetrics.includes(metric)) {
      return c.json({
        error: {
          message: `Invalid metric. Valid metrics: ${validMetrics.join(', ')}`,
          code: 'INVALID_METRIC'
        }
      }, 400);
    }
    
    // Validate horizon
    if (horizon < 1 || horizon > 24) {
      return c.json({
        error: {
          message: 'Horizon must be between 1 and 24 months',
          code: 'INVALID_HORIZON'
        }
      }, 400);
    }
    
    // Get forecast data
    const forecastData = await getForecastData(c.env, metric, areaId, horizon);
    
    if (!forecastData) {
      return c.json({
        error: {
          message: 'Forecast not found for the specified metric and area',
          code: 'FORECAST_NOT_FOUND'
        }
      }, 404);
    }
    
    // Trim forecast to requested horizon
    const forecast = forecastData.forecast?.slice(0, horizon) || [];
    
    const response = {
      area_id: areaId,
      metric: metric,
      horizon: horizon,
      current_value: forecastData.current_value,
      forecast: forecast,
      confidence: forecastData.confidence || 0.7,
      model_type: forecastData.model_type || 'unknown',
      last_updated: forecastData.as_of || new Date().toISOString().split('T')[0],
      metadata: {
        data_source: forecastData.source,
        points_returned: forecast.length,
        model_info: {
          type: forecastData.model_type,
          confidence: forecastData.confidence,
          rmse: forecastData.rmse
        }
      }
    };
    
    // Set cache headers
    c.header('Cache-Control', 'public, max-age=14400'); // 4 hours
    c.header('ETag', `"forecast-${metric}-${areaId}-${horizon}"`);
    
    return c.json(response);
  } catch (error) {
    console.error('Error in /forecast/:metric/:areaId route:', error);
    return c.json({
      error: {
        message: 'Failed to fetch forecast',
        code: 'FETCH_ERROR'
      }
    }, 500);
  }
});

// GET /forecast/metrics - Get available forecast metrics
forecastRoutes.get('/metrics', async (c) => {
  try {
    // Try to get dynamic metrics from D1
    const { results } = await c.env.DB.prepare(`
      SELECT DISTINCT metric, COUNT(*) as count
      FROM forecasts
      GROUP BY metric
      ORDER BY count DESC
    `).all();
    
    const dynamicMetrics = (results as any[]).map(row => ({
      metric: row.metric,
      forecasts_available: row.count,
      description: getMetricDescription(row.metric)
    }));
    
    // Static metric definitions
    const staticMetrics = [
      {
        metric: 'average_rent',
        description: 'Average rental prices by bedroom type',
        unit: 'CAD',
        frequency: 'monthly'
      },
      {
        metric: 'vacancy_rate',
        description: 'Rental vacancy rates',
        unit: 'percentage',
        frequency: 'monthly'
      },
      {
        metric: 'housing_starts',
        description: 'New housing construction starts',
        unit: 'units',
        frequency: 'monthly'
      }
    ];
    
    const response = {
      available_metrics: dynamicMetrics.length > 0 ? dynamicMetrics : staticMetrics,
      metadata: {
        total_metrics: dynamicMetrics.length || staticMetrics.length,
        data_source: dynamicMetrics.length > 0 ? 'dynamic' : 'static'
      }
    };
    
    // Set cache headers
    c.header('Cache-Control', 'public, max-age=3600'); // 1 hour
    
    return c.json(response);
  } catch (error) {
    console.error('Error in /forecast/metrics route:', error);
    return c.json({
      error: {
        message: 'Failed to fetch available metrics',
        code: 'FETCH_ERROR'
      }
    }, 500);
  }
});

// Helper function to get metric descriptions
function getMetricDescription(metric: string): string {
  const descriptions: Record<string, string> = {
    'average_rent': 'Average rental prices',
    'vacancy_rate': 'Rental vacancy rates', 
    'housing_starts': 'New housing construction starts',
    'rent': 'Rental prices'
  };
  
  return descriptions[metric] || 'Forecast metric';
}

// GET /forecast/summary/:areaId - Get forecast summary for all metrics in an area
forecastRoutes.get('/summary/:areaId', async (c) => {
  try {
    const areaId = c.req.param('areaId');
    const horizon = parseInt(c.req.query('h') || '6');
    
    if (!areaId) {
      return c.json({
        error: {
          message: 'Area ID is required',
          code: 'MISSING_AREA_ID'
        }
      }, 400);
    }
    
    // Get all available metrics for this area from D1
    const { results } = await c.env.DB.prepare(`
      SELECT DISTINCT metric
      FROM forecasts
      WHERE area_id = ?
      ORDER BY metric
    `).bind(areaId).all();
    
    const availableMetrics = (results as any[]).map(row => row.metric);
    
    // If no D1 data, try to get from R2
    let forecastSummary: any = {};
    
    if (availableMetrics.length === 0) {
      try {
        const r2Object = await c.env.BUCKET.get('forecasts.json');
        if (r2Object) {
          const allForecasts = await r2Object.json() as any;
          
          for (const [key, forecast] of Object.entries(allForecasts)) {
            const forecastData = forecast as any;
            const matchesArea = (
              forecastData.district === areaId ||
              forecastData.region === areaId ||
              key.includes(areaId.replace(' ', '_'))
            );
            
            if (matchesArea) {
              const metric = forecastData.metric;
              const forecastPoints = forecastData.forecast?.slice(0, horizon) || [];
              
              forecastSummary[metric] = {
                current_value: forecastData.current_value,
                forecast_trend: forecastPoints.length > 0 ? 
                  (forecastPoints[forecastPoints.length - 1].yhat > forecastPoints[0].yhat ? 'increasing' : 'decreasing') : 'stable',
                next_month: forecastPoints[0]?.yhat || 0,
                six_month: forecastPoints[Math.min(5, forecastPoints.length - 1)]?.yhat || 0,
                confidence: forecastData.confidence || 0.7
              };
            }
          }
        }
      } catch (error) {
        console.error('Error fetching R2 forecasts:', error);
      }
    } else {
      // Get forecast summaries from D1
      for (const metric of availableMetrics) {
        const forecastData = await getForecastData(c.env, metric, areaId, horizon);
        
        if (forecastData && forecastData.forecast) {
          const points = forecastData.forecast.slice(0, horizon);
          forecastSummary[metric] = {
            current_value: forecastData.current_value,
            forecast_trend: points.length > 1 ? 
              (points[points.length - 1].yhat > points[0].yhat ? 'increasing' : 'decreasing') : 'stable',
            next_month: points[0]?.yhat || 0,
            six_month: points[Math.min(5, points.length - 1)]?.yhat || 0,
            confidence: forecastData.confidence || 0.7
          };
        }
      }
    }
    
    const response = {
      area_id: areaId,
      horizon: horizon,
      forecasts: forecastSummary,
      metadata: {
        metrics_available: Object.keys(forecastSummary).length,
        last_updated: new Date().toISOString().split('T')[0]
      }
    };
    
    // Set cache headers
    c.header('Cache-Control', 'public, max-age=7200'); // 2 hours
    c.header('ETag', `"summary-${areaId}-${horizon}"`);
    
    return c.json(response);
  } catch (error) {
    console.error('Error in /forecast/summary/:areaId route:', error);
    return c.json({
      error: {
        message: 'Failed to fetch forecast summary',
        code: 'FETCH_ERROR'
      }
    }, 500);
  }
});
