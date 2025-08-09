/**
 * Predictions API Routes for InvestMTL
 * Provides ML-powered price and rent predictions
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

const predictions = new Hono();

predictions.use('/*', cors());

// Types
interface PredictionRequest {
  zone_id?: string;
  quarter?: string;
  limit?: number;
}

interface PredictionResponse {
  zone_id: string;
  street_name: string;
  quarter: string;
  price_per_m2_prediction: number;
  price_confidence_lower: number;
  price_confidence_upper: number;
  rent_prediction: number;
  rent_confidence_lower: number;
  rent_confidence_upper: number;
  model_version: string;
  created_at: string;
}

/**
 * GET /predictions - Get ML predictions for zones
 */
predictions.get('/', async (c) => {
  try {
    const { zone_id, quarter, limit = '20' } = c.req.query();
    
    let query = `
      SELECT 
        p.zone_id,
        iz.street_name,
        p.quarter,
        p.price_per_m2_prediction,
        p.price_confidence_lower,
        p.price_confidence_upper,
        p.rent_prediction,
        p.rent_confidence_lower,
        p.rent_confidence_upper,
        p.model_version,
        p.created_at
      FROM predictions p
      LEFT JOIN investment_zones iz ON p.zone_id = iz.street_name
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (zone_id) {
      query += ` AND p.zone_id = ?`;
      params.push(zone_id);
    }
    
    if (quarter) {
      query += ` AND p.quarter = ?`;
      params.push(quarter);
    }
    
    query += ` ORDER BY p.price_per_m2_prediction DESC LIMIT ?`;
    params.push(parseInt(limit));
    
    const { results } = await c.env.DB.prepare(query).bind(...params).all();
    
    const predictions: PredictionResponse[] = results.map((row: any) => ({
      zone_id: row.zone_id,
      street_name: row.street_name || row.zone_id,
      quarter: row.quarter,
      price_per_m2_prediction: parseFloat(row.price_per_m2_prediction),
      price_confidence_lower: parseFloat(row.price_confidence_lower),
      price_confidence_upper: parseFloat(row.price_confidence_upper),
      rent_prediction: parseFloat(row.rent_prediction),
      rent_confidence_lower: parseFloat(row.rent_confidence_lower),
      rent_confidence_upper: parseFloat(row.rent_confidence_upper),
      model_version: row.model_version,
      created_at: row.created_at
    }));
    
    return c.json({
      data: predictions,
      filters: {
        zone_id: zone_id || null,
        quarter: quarter || null,
        limit: parseInt(limit)
      },
      meta: {
        total_results: predictions.length,
        generated_at: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error fetching predictions:', error);
    return c.json({ 
      error: 'Internal server error',
      message: 'Failed to fetch predictions'
    }, 500);
  }
});

/**
 * GET /predictions/zones/:zone_id - Get predictions for specific zone
 */
predictions.get('/zones/:zone_id', async (c) => {
  try {
    const zone_id = c.req.param('zone_id');
    
    const query = `
      SELECT 
        p.zone_id,
        iz.street_name,
        iz.investment_score,
        iz.property_count,
        iz.total_units,
        p.quarter,
        p.price_per_m2_prediction,
        p.price_confidence_lower,
        p.price_confidence_upper,
        p.rent_prediction,
        p.rent_confidence_lower,
        p.rent_confidence_upper,
        p.model_version,
        p.created_at
      FROM predictions p
      LEFT JOIN investment_zones iz ON p.zone_id = iz.street_name
      WHERE p.zone_id = ?
      ORDER BY p.quarter DESC
      LIMIT 8
    `;
    
    const { results } = await c.env.DB.prepare(query).bind(zone_id).all();
    
    if (results.length === 0) {
      return c.json({
        error: 'Not found',
        message: `No predictions found for zone: ${zone_id}`
      }, 404);
    }
    
    const latest = results[0];
    const history = results.slice(1);
    
    return c.json({
      zone: {
        zone_id: latest.zone_id,
        street_name: latest.street_name || latest.zone_id,
        investment_score: parseFloat(latest.investment_score) || null,
        property_count: parseInt(latest.property_count) || null,
        total_units: parseInt(latest.total_units) || null
      },
      current_prediction: {
        quarter: latest.quarter,
        price_per_m2: {
          prediction: parseFloat(latest.price_per_m2_prediction),
          confidence_lower: parseFloat(latest.price_confidence_lower),
          confidence_upper: parseFloat(latest.price_confidence_upper)
        },
        monthly_rent: {
          prediction: parseFloat(latest.rent_prediction),
          confidence_lower: parseFloat(latest.rent_confidence_lower),
          confidence_upper: parseFloat(latest.rent_confidence_upper)
        },
        model_version: latest.model_version,
        created_at: latest.created_at
      },
      historical_predictions: history.map(row => ({
        quarter: row.quarter,
        price_per_m2: parseFloat(row.price_per_m2_prediction),
        monthly_rent: parseFloat(row.rent_prediction),
        created_at: row.created_at
      }))
    });
    
  } catch (error) {
    console.error('Error fetching zone predictions:', error);
    return c.json({ 
      error: 'Internal server error',
      message: 'Failed to fetch zone predictions'
    }, 500);
  }
});

/**
 * GET /predictions/summary - Get prediction summary statistics
 */
predictions.get('/summary', async (c) => {
  try {
    // Get latest quarter predictions summary
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_zones,
        AVG(price_per_m2_prediction) as avg_price_per_m2,
        MIN(price_per_m2_prediction) as min_price_per_m2,
        MAX(price_per_m2_prediction) as max_price_per_m2,
        AVG(rent_prediction) as avg_monthly_rent,
        MIN(rent_prediction) as min_monthly_rent,
        MAX(rent_prediction) as max_monthly_rent,
        quarter,
        model_version
      FROM predictions 
      WHERE quarter = (SELECT MAX(quarter) FROM predictions)
      GROUP BY quarter, model_version
    `;
    
    const { results: summary } = await c.env.DB.prepare(summaryQuery).all();
    
    // Get top performing zones
    const topZonesQuery = `
      SELECT 
        p.zone_id,
        p.price_per_m2_prediction,
        p.rent_prediction,
        iz.investment_score
      FROM predictions p
      LEFT JOIN investment_zones iz ON p.zone_id = iz.street_name
      WHERE p.quarter = (SELECT MAX(quarter) FROM predictions)
      ORDER BY p.price_per_m2_prediction DESC
      LIMIT 10
    `;
    
    const { results: topZones } = await c.env.DB.prepare(topZonesQuery).all();
    
    if (summary.length === 0) {
      return c.json({
        error: 'No data',
        message: 'No prediction data available'
      }, 404);
    }
    
    const stats = summary[0];
    
    return c.json({
      summary: {
        total_zones_predicted: parseInt(stats.total_zones),
        quarter: stats.quarter,
        model_version: stats.model_version,
        price_statistics: {
          average_price_per_m2: Math.round(parseFloat(stats.avg_price_per_m2)),
          min_price_per_m2: Math.round(parseFloat(stats.min_price_per_m2)),
          max_price_per_m2: Math.round(parseFloat(stats.max_price_per_m2))
        },
        rent_statistics: {
          average_monthly_rent: Math.round(parseFloat(stats.avg_monthly_rent)),
          min_monthly_rent: Math.round(parseFloat(stats.min_monthly_rent)),
          max_monthly_rent: Math.round(parseFloat(stats.max_monthly_rent))
        }
      },
      top_zones: topZones.map(zone => ({
        zone_id: zone.zone_id,
        predicted_price_per_m2: Math.round(parseFloat(zone.price_per_m2_prediction)),
        predicted_monthly_rent: Math.round(parseFloat(zone.rent_prediction)),
        investment_score: parseFloat(zone.investment_score) || null
      })),
      generated_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching prediction summary:', error);
    return c.json({ 
      error: 'Internal server error',
      message: 'Failed to fetch prediction summary'
    }, 500);
  }
});

/**
 * POST /predictions/custom - Get custom predictions for user input
 */
predictions.post('/custom', async (c) => {
  try {
    const body = await c.req.json();
    
    // Validate required fields
    const required = ['superficie_terrain', 'superficie_batiment', 'nb_logements', 'annee_construction'];
    const missing = required.filter(field => !body[field]);
    
    if (missing.length > 0) {
      return c.json({
        error: 'Validation error',
        message: `Missing required fields: ${missing.join(', ')}`
      }, 400);
    }
    
    // For now, return a simplified calculation
    // In production, this would call the actual ML models
    const age = new Date().getFullYear() - body.annee_construction;
    const surface_ratio = body.superficie_batiment / body.superficie_terrain;
    const units_per_building = body.nb_logements;
    
    // Simplified price calculation
    let base_price = 4000; // Base price per m²
    
    // Age adjustment
    if (age <= 10) base_price *= 1.2;
    else if (age <= 20) base_price *= 1.1;
    else if (age > 40) base_price *= 0.9;
    
    // Size adjustment
    if (units_per_building <= 3) base_price *= 1.1;
    else if (units_per_building > 12) base_price *= 0.95;
    
    const predicted_price = Math.round(base_price);
    const price_margin = predicted_price * 0.15;
    
    // Simplified rent calculation
    const avg_unit_size = body.superficie_batiment / body.nb_logements;
    let base_rent = 1500; // Base monthly rent
    
    if (avg_unit_size > 100) base_rent = 2200;
    else if (avg_unit_size > 70) base_rent = 1800;
    else if (avg_unit_size < 50) base_rent = 1300;
    
    // Age adjustment for rent
    if (age <= 15) base_rent *= 1.15;
    else if (age > 30) base_rent *= 0.95;
    
    const predicted_rent = Math.round(base_rent);
    const rent_margin = predicted_rent * 0.12;
    
    return c.json({
      input: body,
      predictions: {
        price_per_m2: {
          prediction: predicted_price,
          confidence_lower: Math.round(predicted_price - price_margin),
          confidence_upper: Math.round(predicted_price + price_margin)
        },
        monthly_rent: {
          prediction: predicted_rent,
          confidence_lower: Math.round(predicted_rent - rent_margin),
          confidence_upper: Math.round(predicted_rent + rent_margin)
        }
      },
      model_version: "simplified_v1.0",
      generated_at: new Date().toISOString(),
      disclaimer: "These are simplified estimates. Actual predictions use trained ML models."
    });
    
  } catch (error) {
    console.error('Error generating custom prediction:', error);
    return c.json({ 
      error: 'Internal server error',
      message: 'Failed to generate custom prediction'
    }, 500);
  }
});

export default predictions;
