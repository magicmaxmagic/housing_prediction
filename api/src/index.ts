import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { areaRoutes } from './routes/areas';
import { scoresRoutes } from './routes/scores';
import { forecastRoutes } from './routes/forecast';
import authRoutes from './routes/auth';
import favoritesRoutes from './routes/favorites';
import predictionsRoutes from './routes/predictions';
import { 
  getEvaluationUnits, 
  getInvestmentZones, 
  getMarketData, 
  searchProperties 
} from './real-estate-endpoints';

// Environment bindings interface
export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  API_VERSION?: string;
  CORS_ORIGINS?: string;
  RATE_LIMIT_REQUESTS?: string;
  RATE_LIMIT_WINDOW?: string;
  JWT_SECRET: string;
}

// Create main Hono app
const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('*', (c, next) => {
  const corsOrigins = c.env.CORS_ORIGINS || '*';
  const corsMiddleware = cors({
    origin: corsOrigins.split(','),
    allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    exposeHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 86400,
    credentials: true,
  });
  return corsMiddleware(c, next);
});

// Global error handler
app.onError((err, c) => {
  console.error('API Error:', err);
  
  return c.json({
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    }
  }, 500);
});

// Health check endpoint
app.get('/health', (c) => {
  const apiVersion = c.env.API_VERSION || '1.0.0';
  
  return c.json({
    status: 'healthy',
    version: apiVersion,
    timestamp: new Date().toISOString(),
    environment: 'production',
    services: {
      database: 'connected',
      storage: 'connected',
      cache: 'connected'
    }
  });
});

// API info endpoint
app.get('/', (c) => {
  const apiVersion = c.env.API_VERSION || '1.0.0';
  
  return c.json({
    name: 'InvestMTL API',
    version: apiVersion,
    description: 'Montreal housing investment analysis API',
    endpoints: {
      areas: '/areas',
      scores: '/scores/:areaId',
      forecasts: '/forecast/:metric/:areaId',
      health: '/health'
    },
    documentation: 'https://github.com/magicmaxmagic/housing_prediction'
  });
});

// Rate limiting middleware (simple implementation)
const rateLimit = async (c: any, next: any) => {
  const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
  const rateLimitKey = `rate_limit:${clientIP}:${Math.floor(Date.now() / 60000)}`; // 1-minute windows
  
  const maxRequests = parseInt(c.env.RATE_LIMIT_REQUESTS || '100');
  const currentCount = await c.env.KV.get(rateLimitKey);
  const count = currentCount ? parseInt(currentCount) : 0;
  
  if (count >= maxRequests) {
    return c.json({
      error: {
        message: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        resetTime: Math.floor(Date.now() / 60000 + 1) * 60000
      }
    }, 429);
  }
  
  // Update counter
  await c.env.KV.put(rateLimitKey, (count + 1).toString(), { expirationTtl: 60 });
  
  // Add rate limit headers
  c.header('X-RateLimit-Limit', maxRequests.toString());
  c.header('X-RateLimit-Remaining', (maxRequests - count - 1).toString());
  c.header('X-RateLimit-Reset', (Math.floor(Date.now() / 60000 + 1) * 60000).toString());
  
  return next();
};

// Apply rate limiting to API routes
app.use('/areas/*', rateLimit);
app.use('/scores/*', rateLimit);
app.use('/forecast/*', rateLimit);
app.use('/evaluation-units/*', rateLimit);
app.use('/investment-zones/*', rateLimit);
app.use('/market-data/*', rateLimit);
app.use('/property-search/*', rateLimit);

// Mount route modules
app.route('/areas', areaRoutes);
app.route('/scores', scoresRoutes);  
app.route('/forecast', forecastRoutes);
app.route('/auth', authRoutes);
app.route('/favorites', favoritesRoutes);
app.route('/predictions', predictionsRoutes);

// Real Estate Data Endpoints
app.get('/evaluation-units', (c) => getEvaluationUnits(c.req.raw, c.env));
app.get('/investment-zones', (c) => getInvestmentZones(c.req.raw, c.env));
app.get('/market-data', (c) => getMarketData(c.req.raw, c.env));
app.get('/property-search', (c) => searchProperties(c.req.raw, c.env));

// 404 handler
app.notFound((c) => {
  return c.json({
    error: {
      message: 'Endpoint not found',
      code: 'NOT_FOUND',
      path: c.req.path
    }
  }, 404);
});

// Export for Cloudflare Workers
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  }
};
