/**
 * Rate Limiter Service
 * Implements rate limiting for authentication attempts and API calls
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxAttempts: number; // Maximum attempts per window
  blockDurationMs: number; // How long to block after exceeding limit
  skipSuccessfulRequests?: boolean; // Don't count successful requests
}

interface RateLimitEntry {
  key: string;
  count: number;
  resetTime: number;
  blockUntil?: number;
}

// In-memory store for rate limiting (in production, use Redis)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Default rate limit configurations
const RATE_LIMITS = {
  // Face verification: 5 attempts per 5 minutes
  faceVerification: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxAttempts: 5,
    blockDurationMs: 15 * 60 * 1000, // 15 minutes
    skipSuccessfulRequests: true
  },
  
  // PIN verification: 5 attempts per 15 minutes
  pinVerification: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 5,
    blockDurationMs: 30 * 60 * 1000, // 30 minutes
    skipSuccessfulRequests: true
  },
  
  // PIN setup: 3 attempts per hour
  pinSetup: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 3,
    blockDurationMs: 2 * 60 * 60 * 1000, // 2 hours
    skipSuccessfulRequests: false
  },
  
  // General API: 100 requests per 15 minutes
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 100,
    blockDurationMs: 60 * 60 * 1000, // 1 hour
    skipSuccessfulRequests: true
  }
};

export class RateLimiter {
  /**
   * Generate rate limit key for user/IP combination
   */
  private static generateKey(type: string, userId?: number, ip?: string): string {
    if (userId) {
      return `${type}:user:${userId}`;
    }
    return `${type}:ip:${ip || 'unknown'}`;
  }

  /**
   * Get current rate limit entry
   */
  private static getEntry(key: string): RateLimitEntry | undefined {
    const entry = rateLimitStore.get(key);
    
    // Clean up expired entries
    if (entry && Date.now() > entry.resetTime) {
      rateLimitStore.delete(key);
      return undefined;
    }
    
    return entry;
  }

  /**
   * Create or update rate limit entry
   */
  private static setEntry(key: string, entry: RateLimitEntry): void {
    rateLimitStore.set(key, entry);
  }

  /**
   * Check if request is rate limited
   */
  static async checkLimit(
    type: keyof typeof RATE_LIMITS,
    userId?: number,
    ip?: string,
    isSuccess: boolean = false
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number; blockUntil?: number }> {
    const config = RATE_LIMITS[type];
    const key = this.generateKey(type, userId, ip);
    const now = Date.now();
    
    let entry = this.getEntry(key);
    
    // Check if currently blocked
    if (entry?.blockUntil && now < entry.blockUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        blockUntil: entry.blockUntil
      };
    }
    
    // Create new entry if doesn't exist
    if (!entry) {
      entry = {
        key,
        count: 0,
        resetTime: now + config.windowMs
      };
    }
    
    // Increment counter if not successful request (and config says to skip)
    if (!isSuccess || !config.skipSuccessfulRequests) {
      entry.count++;
    }
    
    // Check if limit exceeded
    if (entry.count > config.maxAttempts) {
      entry.blockUntil = now + config.blockDurationMs;
      this.setEntry(key, entry);
      
      // Log rate limit violation
      await this.logRateLimitViolation(type, userId, ip, entry.count);
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        blockUntil: entry.blockUntil
      };
    }
    
    // Update entry
    this.setEntry(key, entry);
    
    return {
      allowed: true,
      remaining: Math.max(0, config.maxAttempts - entry.count),
      resetTime: entry.resetTime
    };
  }

  /**
   * Log rate limit violations for security monitoring
   */
  private static async logRateLimitViolation(
    type: string,
    userId?: number,
    ip?: string,
    attempts?: number
  ): Promise<void> {
    try {
      console.warn(`[RATE_LIMIT] Violation detected:`, {
        type,
        userId,
        ip,
        attempts,
        timestamp: new Date().toISOString()
      });
      
      // In a real implementation, you might want to:
      // - Send alerts to security team
      // - Log to security monitoring system
      // - Trigger additional security measures
      
    } catch (error) {
      console.error('[RATE_LIMIT] Failed to log violation:', error);
    }
  }

  /**
   * Reset rate limit for a specific key (admin function)
   */
  static resetLimit(type: string, userId?: number, ip?: string): boolean {
    const key = this.generateKey(type, userId, ip);
    return rateLimitStore.delete(key);
  }

  /**
   * Get rate limit status for a key
   */
  static getStatus(type: string, userId?: number, ip?: string): {
    count: number;
    remaining: number;
    resetTime: number;
    blockUntil?: number;
  } | null {
    const config = RATE_LIMITS[type];
    const key = this.generateKey(type, userId, ip);
    const entry = this.getEntry(key);
    
    if (!entry) {
      return {
        count: 0,
        remaining: config.maxAttempts,
        resetTime: Date.now() + config.windowMs
      };
    }
    
    return {
      count: entry.count,
      remaining: Math.max(0, config.maxAttempts - entry.count),
      resetTime: entry.resetTime,
      blockUntil: entry.blockUntil
    };
  }

  /**
   * Clean up expired entries (call periodically)
   */
  static cleanup(): number {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime && (!entry.blockUntil || now > entry.blockUntil)) {
        rateLimitStore.delete(key);
        cleaned++;
      }
    }
    
    return cleaned;
  }
}

/**
 * Express middleware for rate limiting
 */
export function createRateLimitMiddleware(type: keyof typeof RATE_LIMITS) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const ip = req.ip || req.headers['x-forwarded-for'] as string || req.connection.remoteAddress;
      
      const result = await RateLimiter.checkLimit(type, userId, ip);
      
      if (!result.allowed) {
        const blockUntil = result.blockUntil ? new Date(result.blockUntil).toISOString() : null;
        
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: `Too many ${type} attempts. Please try again later.`,
          remaining: result.remaining,
          resetTime: new Date(result.resetTime).toISOString(),
          blockUntil,
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        });
      }
      
      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': RATE_LIMITS[type].maxAttempts.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString()
      });
      
      // Store result in request for use in route handlers
      (req as any).rateLimit = result;
      
      next();
    } catch (error) {
      console.error('[RATE_LIMIT] Middleware error:', error);
      next(); // Continue on error to avoid breaking the app
    }
  };
}

/**
 * Specialized rate limit middleware for authentication endpoints
 */
export function createAuthRateLimitMiddleware(type: keyof typeof RATE_LIMITS) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const ip = req.ip || req.headers['x-forwarded-for'] as string || req.connection.remoteAddress;
      
      const result = await RateLimiter.checkLimit(type, userId, ip);
      
      if (!result.allowed) {
        // For auth endpoints, also check if we should lock the account
        if (userId && result.blockUntil) {
          await lockUserAccount(userId, result.blockUntil);
        }
        
        const blockUntil = result.blockUntil ? new Date(result.blockUntil).toISOString() : null;
        
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: `Too many ${type} attempts. Your account may be temporarily locked.`,
          remaining: result.remaining,
          resetTime: new Date(result.resetTime).toISOString(),
          blockUntil,
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
          accountLocked: !!result.blockUntil
        });
      }
      
      res.set({
        'X-RateLimit-Limit': RATE_LIMITS[type].maxAttempts.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString()
      });
      
      (req as any).rateLimit = result;
      next();
    } catch (error) {
      console.error('[RATE_LIMIT] Auth middleware error:', error);
      next();
    }
  };
}

/**
 * Lock user account temporarily
 */
async function lockUserAccount(userId: number, unlockTime: number): Promise<void> {
  try {
    await db.update(users)
      .set({ 
        isActive: false,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
    
    console.warn(`[SECURITY] User ${userId} account locked until ${new Date(unlockTime).toISOString()}`);
    
    // Schedule account unlock
    setTimeout(async () => {
      try {
        await db.update(users)
          .set({ 
            isActive: true,
            updatedAt: new Date()
          })
          .where(eq(users.id, userId));
        
        console.log(`[SECURITY] User ${userId} account unlocked`);
      } catch (error) {
        console.error(`[SECURITY] Failed to unlock user ${userId}:`, error);
      }
    }, unlockTime - Date.now());
    
  } catch (error) {
    console.error(`[SECURITY] Failed to lock user ${userId}:`, error);
  }
}

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const cleaned = RateLimiter.cleanup();
  if (cleaned > 0) {
    console.log(`[RATE_LIMIT] Cleaned up ${cleaned} expired entries`);
  }
}, 5 * 60 * 1000);
