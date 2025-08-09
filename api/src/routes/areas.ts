import { Hono } from 'hono';
import { Env } from '../index';

export const areaRoutes = new Hono<{ Bindings: Env }>();

// Helper function to get areas data from R2 or D1
async function getAreasData(env: Env, params: any = {}) {
  try {
    // Try to get from R2 first (cached/optimized data)
    const r2Object = await env.BUCKET.get('api_data.json');
    
    if (r2Object) {
      const data = await r2Object.json() as any;
      return data.areas || [];
    }
    
    // Fallback to D1 query
    const { results } = await env.DB.prepare(`
      SELECT 
        a.id,
        a.name,
        s.s_total as score,
        CASE 
          WHEN s.s_total >= 80 THEN 5
          WHEN s.s_total >= 60 THEN 4  
          WHEN s.s_total >= 40 THEN 3
          WHEN s.s_total >= 20 THEN 2
          ELSE 1
        END as quantile,
        s.as_of as last_updated
      FROM areas a
      LEFT JOIN scores s ON a.id = s.area_id
      ORDER BY s.s_total DESC
      LIMIT ?
    `).bind(params.limit || 100).all();
    
    return results || [];
  } catch (error) {
    console.error('Error fetching areas data:', error);
    throw new Error('Failed to fetch areas data');
  }
}

// Helper function to get geographic data
async function getAreasGeometry(env: Env) {
  try {
    const r2Object = await env.BUCKET.get('areas_topojson.json');
    
    if (r2Object) {
      const geoData = await r2Object.json();
      return geoData;
    }
    
    return { type: 'FeatureCollection', features: [] };
  } catch (error) {
    console.error('Error fetching geometry:', error);
    return { type: 'FeatureCollection', features: [] };
  }
}

// GET /areas - Get all areas with scores
areaRoutes.get('/', async (c) => {
  try {
    const bbox = c.req.query('bbox');
    const metric = c.req.query('metric') || 'score';
    const asOf = c.req.query('asOf');
    const limit = parseInt(c.req.query('limit') || '50');
    const includeGeometry = c.req.query('geometry') === 'true';
    
    // Validate parameters
    if (limit > 200) {
      return c.json({
        error: {
          message: 'Limit cannot exceed 200',
          code: 'INVALID_LIMIT'
        }
      }, 400);
    }
    
    // Get areas data
    const areas = await getAreasData(c.env, { limit });
    
    // If geometry requested, merge with geographic data
    if (includeGeometry) {
      const geoData = await getAreasGeometry(c.env);
      
      // Create GeoJSON FeatureCollection
      const features = geoData.features?.map((feature: any) => {
        const area = areas.find((a: any) => a.id === feature.properties?.id);
        
        return {
          type: 'Feature',
          id: feature.properties?.id,
          properties: {
            name: area?.name || feature.properties?.name,
            score: area?.score || 0,
            quantile: area?.quantile || 1,
            last_updated: area?.last_updated || new Date().toISOString().split('T')[0]
          },
          geometry: feature.geometry
        };
      }) || [];
      
      // Apply bounding box filter if provided
      let filteredFeatures = features;
      if (bbox) {
        const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
        // Simple bbox filtering (centroid-based)
        filteredFeatures = features.filter((feature: any) => {
          if (feature.geometry?.type === 'Polygon' && feature.geometry.coordinates?.[0]) {
            const coords = feature.geometry.coordinates[0];
            const avgLng = coords.reduce((sum: number, coord: number[]) => sum + coord[0], 0) / coords.length;
            const avgLat = coords.reduce((sum: number, coord: number[]) => sum + coord[1], 0) / coords.length;
            
            return avgLng >= minLng && avgLng <= maxLng && avgLat >= minLat && avgLat <= maxLat;
          }
          return true;
        });
      }
      
      const response = {
        type: 'FeatureCollection',
        features: filteredFeatures,
        metadata: {
          total: filteredFeatures.length,
          metric: metric,
          as_of: asOf || new Date().toISOString().split('T')[0],
          bbox: bbox || null
        }
      };
      
      // Set cache headers
      c.header('Cache-Control', 'public, max-age=86400'); // 24 hours
      c.header('ETag', `"areas-${Date.now()}-${filteredFeatures.length}"`);
      
      return c.json(response);
    } else {
      // Return simple areas list without geometry
      const response = {
        areas: areas.slice(0, limit),
        metadata: {
          total: areas.length,
          returned: Math.min(limit, areas.length),
          metric: metric,
          as_of: asOf || new Date().toISOString().split('T')[0]
        }
      };
      
      // Set cache headers
      c.header('Cache-Control', 'public, max-age=3600'); // 1 hour
      c.header('ETag', `"areas-simple-${Date.now()}-${areas.length}"`);
      
      return c.json(response);
    }
  } catch (error) {
    console.error('Error in /areas route:', error);
    return c.json({
      error: {
        message: 'Failed to fetch areas data',
        code: 'FETCH_ERROR'
      }
    }, 500);
  }
});

// GET /areas/:areaId - Get specific area details
areaRoutes.get('/:areaId', async (c) => {
  try {
    const areaId = c.req.param('areaId');
    
    if (!areaId) {
      return c.json({
        error: {
          message: 'Area ID is required',
          code: 'MISSING_AREA_ID'
        }
      }, 400);
    }
    
    // Get area from D1
    const { results } = await c.env.DB.prepare(`
      SELECT 
        a.id,
        a.name,
        a.geo_bbox,
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
      LIMIT 1
    `).bind(areaId).all();
    
    if (!results || results.length === 0) {
      return c.json({
        error: {
          message: 'Area not found',
          code: 'AREA_NOT_FOUND'
        }
      }, 404);
    }
    
    const area = results[0] as any;
    
    const response = {
      area_id: area.id,
      name: area.name,
      as_of: area.as_of,
      scores: {
        growth: area.s_growth || 0,
        supply: area.s_supply || 0,
        tension: area.s_tension || 0,
        accessibility: area.s_access || 0,
        returns: area.s_return || 0,
        total: area.s_total || 0
      },
      geo_bbox: area.geo_bbox
    };
    
    // Set cache headers
    c.header('Cache-Control', 'public, max-age=3600'); // 1 hour
    c.header('ETag', `"area-${areaId}-${area.as_of}"`);
    
    return c.json(response);
  } catch (error) {
    console.error('Error in /areas/:areaId route:', error);
    return c.json({
      error: {
        message: 'Failed to fetch area details',
        code: 'FETCH_ERROR'
      }
    }, 500);
  }
});
