import { Hono } from 'hono';
import { Env } from '../index';

export const scoresRoutes = new Hono<{ Bindings: Env }>();

// Default weights for scoring
const DEFAULT_WEIGHTS = {
  growth: 0.25,
  supply: 0.20,
  tension: 0.20,
  accessibility: 0.20,
  returns: 0.15
};

// Helper function to calculate custom weighted score
function calculateWeightedScore(scores: any, weights: any = DEFAULT_WEIGHTS) {
  const total = (
    (scores.growth || 0) * weights.growth +
    (scores.supply || 0) * weights.supply +
    (scores.tension || 0) * weights.tension +
    (scores.accessibility || 0) * weights.accessibility +
    (scores.returns || 0) * weights.returns
  );
  
  return Math.round(total * 10) / 10; // Round to 1 decimal
}

// GET /scores/:areaId - Get detailed scores for an area
scoresRoutes.get('/:areaId', async (c) => {
  try {
    const areaId = c.req.param('areaId');
    const asOf = c.req.query('asOf');
    
    // Parse custom weights from query parameters
    const customWeights = {
      growth: parseFloat(c.req.query('w_growth') || '') || DEFAULT_WEIGHTS.growth,
      supply: parseFloat(c.req.query('w_supply') || '') || DEFAULT_WEIGHTS.supply,
      tension: parseFloat(c.req.query('w_tension') || '') || DEFAULT_WEIGHTS.tension,
      accessibility: parseFloat(c.req.query('w_accessibility') || '') || DEFAULT_WEIGHTS.accessibility,
      returns: parseFloat(c.req.query('w_returns') || '') || DEFAULT_WEIGHTS.returns
    };
    
    // Normalize weights to sum to 1
    const totalWeight = Object.values(customWeights).reduce((sum, weight) => sum + weight, 0);
    if (totalWeight > 0) {
      Object.keys(customWeights).forEach(key => {
        customWeights[key as keyof typeof customWeights] /= totalWeight;
      });
    }
    
    if (!areaId) {
      return c.json({
        error: {
          message: 'Area ID is required',
          code: 'MISSING_AREA_ID'
        }
      }, 400);
    }
    
    // Get scores from D1
    let query = `
      SELECT 
        a.id,
        a.name,
        s.s_growth,
        s.s_supply, 
        s.s_tension,
        s.s_access,
        s.s_return,
        s.s_total,
        s.as_of
      FROM areas a
      LEFT JOIN scores s ON a.id = s.area_id
      WHERE a.id = ?
    `;
    
    const params = [areaId];
    
    // Add date filter if provided
    if (asOf) {
      query += ` AND s.as_of <= ?`;
      params.push(asOf);
    }
    
    query += ` ORDER BY s.as_of DESC LIMIT 1`;
    
    const { results } = await c.env.DB.prepare(query).bind(...params).all();
    
    if (!results || results.length === 0) {
      return c.json({
        error: {
          message: 'Area or scores not found',
          code: 'NOT_FOUND'
        }
      }, 404);
    }
    
    const row = results[0] as any;
    
    const scores = {
      growth: row.s_growth || 0,
      supply: row.s_supply || 0,
      tension: row.s_tension || 0,
      accessibility: row.s_access || 0,
      returns: row.s_return || 0
    };
    
    // Calculate custom weighted total if weights were provided
    const customTotal = calculateWeightedScore(scores, customWeights);
    const usingCustomWeights = JSON.stringify(customWeights) !== JSON.stringify(DEFAULT_WEIGHTS);
    
    const response = {
      area_id: areaId,
      name: row.name,
      as_of: row.as_of,
      scores: {
        ...scores,
        total: usingCustomWeights ? customTotal : (row.s_total || 0)
      },
      weights: customWeights,
      metadata: {
        using_custom_weights: usingCustomWeights,
        original_total: row.s_total || 0,
        calculation_method: usingCustomWeights ? 'client_weighted' : 'precomputed'
      }
    };
    
    // Set cache headers (shorter cache for custom weights)
    const cacheTime = usingCustomWeights ? 300 : 3600; // 5 min vs 1 hour
    c.header('Cache-Control', `public, max-age=${cacheTime}`);
    c.header('ETag', `"scores-${areaId}-${row.as_of}-${usingCustomWeights ? 'custom' : 'default'}"`);
    
    return c.json(response);
  } catch (error) {
    console.error('Error in /scores/:areaId route:', error);
    return c.json({
      error: {
        message: 'Failed to fetch scores',
        code: 'FETCH_ERROR'
      }
    }, 500);
  }
});

// GET /scores/compare - Compare multiple areas
scoresRoutes.get('/compare', async (c) => {
  try {
    const areaIds = c.req.query('areas');
    const asOf = c.req.query('asOf');
    
    if (!areaIds) {
      return c.json({
        error: {
          message: 'Area IDs are required (comma-separated)',
          code: 'MISSING_AREA_IDS'
        }
      }, 400);
    }
    
    const idsArray = areaIds.split(',').map(id => id.trim()).slice(0, 5); // Limit to 5 areas
    
    if (idsArray.length === 0) {
      return c.json({
        error: {
          message: 'At least one valid area ID is required',
          code: 'INVALID_AREA_IDS'
        }
      }, 400);
    }
    
    // Build query with placeholders
    const placeholders = idsArray.map(() => '?').join(',');
    let query = `
      SELECT 
        a.id,
        a.name,
        s.s_growth,
        s.s_supply,
        s.s_tension, 
        s.s_access,
        s.s_return,
        s.s_total,
        s.as_of
      FROM areas a
      LEFT JOIN scores s ON a.id = s.area_id
      WHERE a.id IN (${placeholders})
    `;
    
    const params = [...idsArray];
    
    if (asOf) {
      query += ` AND s.as_of <= ?`;
      params.push(asOf);
    }
    
    query += ` ORDER BY s.s_total DESC`;
    
    const { results } = await c.env.DB.prepare(query).bind(...params).all();
    
    const comparison = (results as any[]).map(row => ({
      area_id: row.id,
      name: row.name,
      as_of: row.as_of,
      scores: {
        growth: row.s_growth || 0,
        supply: row.s_supply || 0,
        tension: row.s_tension || 0,
        accessibility: row.s_access || 0,
        returns: row.s_return || 0,
        total: row.s_total || 0
      }
    }));
    
    // Calculate comparative stats
    const allTotals = comparison.map(c => c.scores.total).filter(t => t > 0);
    const stats = {
      count: comparison.length,
      highest_score: allTotals.length > 0 ? Math.max(...allTotals) : 0,
      lowest_score: allTotals.length > 0 ? Math.min(...allTotals) : 0,
      average_score: allTotals.length > 0 ? 
        Math.round(allTotals.reduce((sum, score) => sum + score, 0) / allTotals.length * 10) / 10 : 0
    };
    
    const response = {
      comparison,
      statistics: stats,
      metadata: {
        requested_areas: idsArray.length,
        found_areas: comparison.length,
        as_of: asOf || 'latest'
      }
    };
    
    // Set cache headers
    c.header('Cache-Control', 'public, max-age=1800'); // 30 minutes
    c.header('ETag', `"compare-${idsArray.join('-')}-${asOf || 'latest'}"`);
    
    return c.json(response);
  } catch (error) {
    console.error('Error in /scores/compare route:', error);
    return c.json({
      error: {
        message: 'Failed to compare areas',
        code: 'FETCH_ERROR'
      }
    }, 500);
  }
});

// GET /scores/top - Get top-scoring areas
scoresRoutes.get('/top', async (c) => {
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50);
    const asOf = c.req.query('asOf');
    
    let query = `
      SELECT 
        a.id,
        a.name,
        s.s_total,
        s.as_of,
        CASE 
          WHEN s.s_total >= 80 THEN 5
          WHEN s.s_total >= 60 THEN 4
          WHEN s.s_total >= 40 THEN 3
          WHEN s.s_total >= 20 THEN 2
          ELSE 1
        END as quantile
      FROM areas a
      LEFT JOIN scores s ON a.id = s.area_id
      WHERE s.s_total IS NOT NULL
    `;
    
    const params: string[] = [];
    
    if (asOf) {
      query += ` AND s.as_of <= ?`;
      params.push(asOf);
    }
    
    query += ` ORDER BY s.s_total DESC LIMIT ?`;
    params.push(limit.toString());
    
    const { results } = await c.env.DB.prepare(query).bind(...params).all();
    
    const topAreas = (results as any[]).map(row => ({
      area_id: row.id,
      name: row.name,
      score: row.s_total,
      quantile: row.quantile,
      as_of: row.as_of
    }));
    
    const response = {
      top_areas: topAreas,
      metadata: {
        limit: limit,
        returned: topAreas.length,
        as_of: asOf || 'latest'
      }
    };
    
    // Set cache headers
    c.header('Cache-Control', 'public, max-age=7200'); // 2 hours
    c.header('ETag', `"top-areas-${limit}-${asOf || 'latest'}"`);
    
    return c.json(response);
  } catch (error) {
    console.error('Error in /scores/top route:', error);
    return c.json({
      error: {
        message: 'Failed to fetch top areas',
        code: 'FETCH_ERROR'
      }
    }, 500);
  }
});
