/**
 * Authentication routes for InvestMTL
 * Handles user registration, login, and JWT token management
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt, sign, verify } from 'hono/jwt';
import { env } from 'hono/adapter';

const auth = new Hono<{ 
  Bindings: { 
    DB: D1Database; 
    JWT_SECRET: string; 
  } 
}>();

auth.use('/*', cors());

// Types
interface User {
  id: number;
  email: string;
  created_at: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  confirm_password: string;
}

// Utility functions
const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password: string): { valid: boolean; message?: string } => {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain both letters and numbers' };
  }
  return { valid: true };
};

/**
 * POST /auth/register - User registration
 */
auth.post('/register', async (c) => {
  try {
    const body: RegisterRequest = await c.req.json();
    const { email, password, confirm_password } = body;
    
    // Validation
    if (!email || !password || !confirm_password) {
      return c.json({
        error: 'Validation error',
        message: 'Email, password, and password confirmation are required'
      }, 400);
    }
    
    if (!validateEmail(email)) {
      return c.json({
        error: 'Validation error',
        message: 'Invalid email format'
      }, 400);
    }
    
    if (password !== confirm_password) {
      return c.json({
        error: 'Validation error',
        message: 'Passwords do not match'
      }, 400);
    }
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return c.json({
        error: 'Validation error',
        message: passwordValidation.message
      }, 400);
    }
    
    // Check if user already exists
    const existingUser = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first();
    
    if (existingUser) {
      return c.json({
        error: 'Conflict',
        message: 'User with this email already exists'
      }, 409);
    }
    
    // Hash password and create user
    const passwordHash = await hashPassword(password);
    
    const result = await c.env.DB.prepare(`
      INSERT INTO users (email, password_hash, created_at, updated_at)
      VALUES (?, ?, datetime('now'), datetime('now'))
    `).bind(email, passwordHash).run();
    
    if (!result.success) {
      throw new Error('Failed to create user');
    }
    
    // Get the created user
    const newUser = await c.env.DB.prepare(
      'SELECT id, email, created_at FROM users WHERE id = ?'
    ).bind(result.meta.last_row_id).first() as User;
    
    // Create JWT token
    const token = await sign({
      user_id: newUser.id,
      email: newUser.email,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 days
    }, c.env.JWT_SECRET);
    
    return c.json({
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        created_at: newUser.created_at
      },
      token
    }, 201);
    
  } catch (error) {
    console.error('Registration error:', error);
    return c.json({
      error: 'Internal server error',
      message: 'Failed to register user'
    }, 500);
  }
});

/**
 * POST /auth/login - User login
 */
auth.post('/login', async (c) => {
  try {
    const body: LoginRequest = await c.req.json();
    const { email, password } = body;
    
    // Validation
    if (!email || !password) {
      return c.json({
        error: 'Validation error',
        message: 'Email and password are required'
      }, 400);
    }
    
    // Find user
    const user = await c.env.DB.prepare(
      'SELECT id, email, password_hash, created_at FROM users WHERE email = ?'
    ).bind(email).first();
    
    if (!user) {
      return c.json({
        error: 'Authentication failed',
        message: 'Invalid email or password'
      }, 401);
    }
    
    // Verify password
    const passwordHash = await hashPassword(password);
    if (passwordHash !== user.password_hash) {
      return c.json({
        error: 'Authentication failed',
        message: 'Invalid email or password'
      }, 401);
    }
    
    // Update last login
    await c.env.DB.prepare(
      'UPDATE users SET updated_at = datetime("now") WHERE id = ?'
    ).bind(user.id).run();
    
    // Create JWT token
    const token = await sign({
      user_id: user.id,
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 days
    }, c.env.JWT_SECRET);
    
    return c.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      },
      token
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return c.json({
      error: 'Internal server error',
      message: 'Failed to authenticate user'
    }, 500);
  }
});

/**
 * POST /auth/verify - Verify JWT token
 */
auth.post('/verify', async (c) => {
  try {
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
      
      // Check if user still exists
      const user = await c.env.DB.prepare(
        'SELECT id, email, created_at FROM users WHERE id = ?'
      ).bind(payload.user_id).first() as User;
      
      if (!user) {
        return c.json({
          error: 'Authentication failed',
          message: 'User not found'
        }, 401);
      }
      
      return c.json({
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          created_at: user.created_at
        }
      });
      
    } catch (jwtError) {
      return c.json({
        error: 'Authentication failed',
        message: 'Invalid or expired token'
      }, 401);
    }
    
  } catch (error) {
    console.error('Token verification error:', error);
    return c.json({
      error: 'Internal server error',
      message: 'Failed to verify token'
    }, 500);
  }
});

/**
 * POST /auth/refresh - Refresh JWT token
 */
auth.post('/refresh', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({
        error: 'Authentication required',
        message: 'Missing authorization header'
      }, 401);
    }
    
    const token = authHeader.substring(7);
    
    try {
      const payload = await verify(token, c.env.JWT_SECRET);
      
      // Check if user still exists
      const user = await c.env.DB.prepare(
        'SELECT id, email, created_at FROM users WHERE id = ?'
      ).bind(payload.user_id).first() as User;
      
      if (!user) {
        return c.json({
          error: 'Authentication failed',
          message: 'User not found'
        }, 401);
      }
      
      // Create new token
      const newToken = await sign({
        user_id: user.id,
        email: user.email,
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 days
      }, c.env.JWT_SECRET);
      
      return c.json({
        message: 'Token refreshed successfully',
        token: newToken
      });
      
    } catch (jwtError) {
      return c.json({
        error: 'Authentication failed',
        message: 'Invalid or expired token'
      }, 401);
    }
    
  } catch (error) {
    console.error('Token refresh error:', error);
    return c.json({
      error: 'Internal server error',
      message: 'Failed to refresh token'
    }, 500);
  }
});

/**
 * GET /auth/me - Get current user info
 */
auth.get('/me', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({
        error: 'Authentication required',
        message: 'Missing authorization header'
      }, 401);
    }
    
    const token = authHeader.substring(7);
    
    try {
      const payload = await verify(token, c.env.JWT_SECRET);
      
      const user = await c.env.DB.prepare(`
        SELECT 
          id, 
          email, 
          created_at,
          (SELECT COUNT(*) FROM favorites WHERE user_id = users.id) as favorites_count
        FROM users 
        WHERE id = ?
      `).bind(payload.user_id).first();
      
      if (!user) {
        return c.json({
          error: 'Authentication failed',
          message: 'User not found'
        }, 401);
      }
      
      return c.json({
        user: {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          favorites_count: user.favorites_count || 0
        }
      });
      
    } catch (jwtError) {
      return c.json({
        error: 'Authentication failed',
        message: 'Invalid or expired token'
      }, 401);
    }
    
  } catch (error) {
    console.error('Get user info error:', error);
    return c.json({
      error: 'Internal server error',
      message: 'Failed to get user information'
    }, 500);
  }
});

export default auth;
