/**
 * Favorites API Routes for InvestMTL
 * Handles user favorites for investment zones
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verify } from 'hono/jwt';

const favorites = new Hono<{ 
  Bindings: { 
    DB: D1Database; 
    JWT_SECRET: string; 
  } 
}>();

favorites.use('/*', cors());

// Types
interface Favorite {
  id: number;
  user_id: number;
  zone_id: string;
  created_at: string;
}

interface FavoriteWithZoneInfo extends Favorite {
  street_name?: string;
  investment_score?: number;
  property_count?: number;
  total_units?: number;
  predicted_price_per_m2?: number;
  predicted_rent?: number;
}

// Middleware to verify JWT and extract user
const authenticateUser = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({
      error: 'Authentication required',
      message: 'Missing or invalid authorization header'
    }, 401);
  }
  
  const token = authHeader.substring(7);
  
  try {
    const payload = await verify(token, c.env.JWT_SECRET);
    c.set('user', payload);
    await next();
  } catch (error) {
    return c.json({
      error: 'Authentication failed',
      message: 'Invalid or expired token'
    }, 401);
  }
};

favorites.use('/*', authenticateUser);

/**
 * GET /favorites - Get user's favorite zones
 */
favorites.get('/', async (c) => {
  try {
    const user = c.get('user');
    const { limit = '20', offset = '0' } = c.req.query();
    
    const query = `
      SELECT 
        f.id,
        f.user_id,
        f.zone_id,
        f.created_at,
        iz.street_name,
        iz.investment_score,
        iz.property_count,
        iz.total_units,
        p.price_per_m2_prediction as predicted_price_per_m2,
        p.rent_prediction as predicted_rent
      FROM favorites f
      LEFT JOIN investment_zones iz ON f.zone_id = iz.street_name
      LEFT JOIN predictions p ON f.zone_id = p.zone_id 
        AND p.quarter = (SELECT MAX(quarter) FROM predictions WHERE zone_id = f.zone_id)
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const { results } = await c.env.DB.prepare(query)
      .bind(user.user_id, parseInt(limit), parseInt(offset))
      .all();
    
    const favoritesData: FavoriteWithZoneInfo[] = results.map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      zone_id: row.zone_id,
      created_at: row.created_at,
      street_name: row.street_name || row.zone_id,
      investment_score: row.investment_score ? parseFloat(row.investment_score) : null,
      property_count: row.property_count ? parseInt(row.property_count) : null,
      total_units: row.total_units ? parseInt(row.total_units) : null,
      predicted_price_per_m2: row.predicted_price_per_m2 ? Math.round(parseFloat(row.predicted_price_per_m2)) : null,
      predicted_rent: row.predicted_rent ? Math.round(parseFloat(row.predicted_rent)) : null
    }));
    
    // Get total count for pagination
    const countResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM favorites WHERE user_id = ?'
    ).bind(user.user_id).first();
    
    return c.json({
      data: favoritesData,
      pagination: {
        total: countResult?.total || 0,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: (parseInt(offset) + parseInt(limit)) < (countResult?.total || 0)
      }
    });
    
  } catch (error) {
    console.error('Error fetching favorites:', error);
    return c.json({
      error: 'Internal server error',
      message: 'Failed to fetch favorites'
    }, 500);
  }
});

/**
 * POST /favorites - Add zone to favorites
 */
favorites.post('/', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { zone_id } = body;
    
    if (!zone_id) {
      return c.json({
        error: 'Validation error',
        message: 'zone_id is required'
      }, 400);
    }
    
    // Check if zone exists in investment_zones
    const zoneExists = await c.env.DB.prepare(
      'SELECT street_name FROM investment_zones WHERE street_name = ?'
    ).bind(zone_id).first();
    
    if (!zoneExists) {
      return c.json({
        error: 'Not found',
        message: 'Investment zone not found'
      }, 404);
    }
    
    // Check if already favorited
    const existingFavorite = await c.env.DB.prepare(
      'SELECT id FROM favorites WHERE user_id = ? AND zone_id = ?'
    ).bind(user.user_id, zone_id).first();
    
    if (existingFavorite) {
      return c.json({
        error: 'Conflict',
        message: 'Zone is already in favorites'
      }, 409);
    }
    
    // Add to favorites
    const result = await c.env.DB.prepare(`
      INSERT INTO favorites (user_id, zone_id, created_at)
      VALUES (?, ?, datetime('now'))
    `).bind(user.user_id, zone_id).run();
    
    if (!result.success) {
      throw new Error('Failed to add favorite');
    }
    
    // Get the created favorite with zone info
    const newFavorite = await c.env.DB.prepare(`
      SELECT 
        f.id,
        f.user_id,
        f.zone_id,
        f.created_at,
        iz.street_name,
        iz.investment_score,
        iz.property_count,
        iz.total_units
      FROM favorites f
      LEFT JOIN investment_zones iz ON f.zone_id = iz.street_name
      WHERE f.id = ?
    `).bind(result.meta.last_row_id).first();
    
    return c.json({
      message: 'Zone added to favorites',
      favorite: {
        id: newFavorite.id,
        zone_id: newFavorite.zone_id,
        street_name: newFavorite.street_name || newFavorite.zone_id,
        investment_score: newFavorite.investment_score ? parseFloat(newFavorite.investment_score) : null,
        property_count: newFavorite.property_count ? parseInt(newFavorite.property_count) : null,
        total_units: newFavorite.total_units ? parseInt(newFavorite.total_units) : null,
        created_at: newFavorite.created_at
      }
    }, 201);
    
  } catch (error) {
    console.error('Error adding favorite:', error);
    return c.json({
      error: 'Internal server error',
      message: 'Failed to add zone to favorites'
    }, 500);
  }
});

/**
 * DELETE /favorites/:favorite_id - Remove zone from favorites
 */
favorites.delete('/:favorite_id', async (c) => {
  try {
    const user = c.get('user');
    const favoriteId = c.req.param('favorite_id');
    
    // Check if favorite exists and belongs to user
    const favorite = await c.env.DB.prepare(
      'SELECT id, zone_id FROM favorites WHERE id = ? AND user_id = ?'
    ).bind(parseInt(favoriteId), user.user_id).first();
    
    if (!favorite) {
      return c.json({
        error: 'Not found',
        message: 'Favorite not found or does not belong to user'
      }, 404);
    }
    
    // Delete the favorite
    const result = await c.env.DB.prepare(
      'DELETE FROM favorites WHERE id = ? AND user_id = ?'
    ).bind(parseInt(favoriteId), user.user_id).run();
    
    if (!result.success) {
      throw new Error('Failed to delete favorite');
    }
    
    return c.json({
      message: 'Zone removed from favorites',
      deleted_favorite: {
        id: parseInt(favoriteId),
        zone_id: favorite.zone_id
      }
    });
    
  } catch (error) {
    console.error('Error removing favorite:', error);
    return c.json({
      error: 'Internal server error',
      message: 'Failed to remove zone from favorites'
    }, 500);
  }
});

/**
 * POST /favorites/toggle - Toggle favorite status for a zone
 */
favorites.post('/toggle', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { zone_id } = body;
    
    if (!zone_id) {
      return c.json({
        error: 'Validation error',
        message: 'zone_id is required'
      }, 400);
    }
    
    // Check if zone exists
    const zoneExists = await c.env.DB.prepare(
      'SELECT street_name FROM investment_zones WHERE street_name = ?'
    ).bind(zone_id).first();
    
    if (!zoneExists) {
      return c.json({
        error: 'Not found',
        message: 'Investment zone not found'
      }, 404);
    }
    
    // Check if already favorited
    const existingFavorite = await c.env.DB.prepare(
      'SELECT id FROM favorites WHERE user_id = ? AND zone_id = ?'
    ).bind(user.user_id, zone_id).first();
    
    if (existingFavorite) {
      // Remove from favorites
      await c.env.DB.prepare(
        'DELETE FROM favorites WHERE id = ?'
      ).bind(existingFavorite.id).run();
      
      return c.json({
        message: 'Zone removed from favorites',
        action: 'removed',
        zone_id: zone_id,
        is_favorite: false
      });
      
    } else {
      // Add to favorites
      const result = await c.env.DB.prepare(`
        INSERT INTO favorites (user_id, zone_id, created_at)
        VALUES (?, ?, datetime('now'))
      `).bind(user.user_id, zone_id).run();
      
      return c.json({
        message: 'Zone added to favorites',
        action: 'added',
        zone_id: zone_id,
        is_favorite: true,
        favorite_id: result.meta.last_row_id
      }, 201);
    }
    
  } catch (error) {
    console.error('Error toggling favorite:', error);
    return c.json({
      error: 'Internal server error',
      message: 'Failed to toggle favorite status'
    }, 500);
  }
});

/**
 * GET /favorites/check/:zone_id - Check if zone is favorited
 */
favorites.get('/check/:zone_id', async (c) => {
  try {
    const user = c.get('user');
    const zoneId = c.req.param('zone_id');
    
    const favorite = await c.env.DB.prepare(
      'SELECT id, created_at FROM favorites WHERE user_id = ? AND zone_id = ?'
    ).bind(user.user_id, zoneId).first();
    
    return c.json({
      zone_id: zoneId,
      is_favorite: !!favorite,
      favorite_id: favorite?.id || null,
      favorited_at: favorite?.created_at || null
    });
    
  } catch (error) {
    console.error('Error checking favorite status:', error);
    return c.json({
      error: 'Internal server error',
      message: 'Failed to check favorite status'
    }, 500);
  }
});

/**
 * GET /favorites/stats - Get user's favorites statistics
 */
favorites.get('/stats', async (c) => {
  try {
    const user = c.get('user');
    
    const statsQuery = `
      SELECT 
        COUNT(*) as total_favorites,
        AVG(iz.investment_score) as avg_investment_score,
        MAX(iz.investment_score) as max_investment_score,
        MIN(iz.investment_score) as min_investment_score,
        SUM(iz.total_units) as total_units_favorited
      FROM favorites f
      LEFT JOIN investment_zones iz ON f.zone_id = iz.street_name
      WHERE f.user_id = ?
    `;
    
    const stats = await c.env.DB.prepare(statsQuery).bind(user.user_id).first();
    
    // Get recent favorites
    const recentFavorites = await c.env.DB.prepare(`
      SELECT f.zone_id, f.created_at, iz.street_name, iz.investment_score
      FROM favorites f
      LEFT JOIN investment_zones iz ON f.zone_id = iz.street_name
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
      LIMIT 5
    `).bind(user.user_id).all();
    
    return c.json({
      stats: {
        total_favorites: parseInt(stats?.total_favorites) || 0,
        avg_investment_score: stats?.avg_investment_score ? parseFloat(stats.avg_investment_score).toFixed(1) : null,
        max_investment_score: stats?.max_investment_score ? parseFloat(stats.max_investment_score) : null,
        min_investment_score: stats?.min_investment_score ? parseFloat(stats.min_investment_score) : null,
        total_units_favorited: parseInt(stats?.total_units_favorited) || 0
      },
      recent_favorites: recentFavorites.results.map((fav: any) => ({
        zone_id: fav.zone_id,
        street_name: fav.street_name || fav.zone_id,
        investment_score: fav.investment_score ? parseFloat(fav.investment_score) : null,
        favorited_at: fav.created_at
      }))
    });
    
  } catch (error) {
    console.error('Error fetching favorite stats:', error);
    return c.json({
      error: 'Internal server error',
      message: 'Failed to fetch favorite statistics'
    }, 500);
  }
});

export default favorites;
