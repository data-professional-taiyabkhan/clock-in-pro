/**
 * Device Fingerprinting Service
 * Tracks and validates device information for security purposes
 */

import { Request } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

interface DeviceInfo {
  userAgent: string;
  platform: string;
  browser: string;
  deviceType: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
  ipAddress: string;
  fingerprint: string;
}

interface DeviceFingerprint {
  id: string;
  userId: number;
  deviceInfo: DeviceInfo;
  firstSeen: Date;
  lastSeen: Date;
  isTrusted: boolean;
  isActive: boolean;
  locationCount: number;
  verificationCount: number;
}

interface SuspiciousActivity {
  type: 'new_device' | 'location_change' | 'unusual_pattern' | 'multiple_failures';
  severity: 'low' | 'medium' | 'high';
  description: string;
  metadata: Record<string, any>;
  timestamp: Date;
}

export class DeviceFingerprinting {
  /**
   * Generate device fingerprint from request headers and info
   */
  static generateFingerprint(req: Request, additionalInfo?: Record<string, any>): string {
    const components = [
      req.headers['user-agent'] || '',
      req.headers['accept-language'] || '',
      req.headers['accept-encoding'] || '',
      req.ip || '',
      req.headers['x-forwarded-for'] as string || '',
      req.headers['x-real-ip'] as string || '',
      additionalInfo?.screenResolution || '',
      additionalInfo?.timezone || '',
      additionalInfo?.platform || '',
      additionalInfo?.browser || '',
      additionalInfo?.deviceType || ''
    ];
    
    const fingerprint = crypto
      .createHash('sha256')
      .update(components.join('|'))
      .digest('hex');
    
    return fingerprint;
  }

  /**
   * Extract device information from request
   */
  static extractDeviceInfo(req: Request, additionalInfo?: Record<string, any>): DeviceInfo {
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = req.ip || 
                     req.headers['x-forwarded-for'] as string || 
                     req.headers['x-real-ip'] as string || 
                     req.connection?.remoteAddress || 
                     'unknown';

    return {
      userAgent,
      ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
      platform: this.parsePlatform(userAgent),
      browser: this.parseBrowser(userAgent),
      deviceType: this.parseDeviceType(userAgent),
      screenResolution: additionalInfo?.screenResolution,
      timezone: additionalInfo?.timezone,
      language: req.headers['accept-language'] as string,
      fingerprint: this.generateFingerprint(req, additionalInfo)
    };
  }

  /**
   * Parse platform from user agent
   */
  private static parsePlatform(userAgent: string): string {
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac OS')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    if (userAgent.includes('iPad')) return 'iPadOS';
    return 'Unknown';
  }

  /**
   * Parse browser from user agent
   */
  private static parseBrowser(userAgent: string): string {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';
    return 'Unknown';
  }

  /**
   * Parse device type from user agent
   */
  private static parseDeviceType(userAgent: string): string {
    if (userAgent.includes('Mobile')) return 'Mobile';
    if (userAgent.includes('Tablet')) return 'Tablet';
    if (userAgent.includes('iPad')) return 'Tablet';
    return 'Desktop';
  }

  /**
   * Check if device is known for user
   */
  static async isKnownDevice(userId: number, fingerprint: string): Promise<boolean> {
    try {
      // In a real implementation, you would store device fingerprints in a separate table
      // For now, we'll use a simple approach with user metadata
      const user = await db.select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      
      if (user.length === 0) return false;
      
      // Check if fingerprint exists in user's known devices (stored in metadata)
      const knownDevices = user[0].metadata as any || {};
      return knownDevices[fingerprint] !== undefined;
    } catch (error) {
      console.error('[DEVICE_FINGERPRINT] Error checking known device:', error);
      return false;
    }
  }

  /**
   * Register new device for user
   */
  static async registerDevice(
    userId: number, 
    deviceInfo: DeviceInfo, 
    isTrusted: boolean = false
  ): Promise<void> {
    try {
      const user = await db.select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      
      if (user.length === 0) return;
      
      const currentMetadata = user[0].metadata as any || {};
      const deviceData = {
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        isTrusted,
        isActive: true,
        deviceInfo,
        verificationCount: 0
      };
      
      currentMetadata.devices = currentMetadata.devices || {};
      currentMetadata.devices[deviceInfo.fingerprint] = deviceData;
      
      await db.update(users)
        .set({ 
          metadata: currentMetadata,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));
      
      console.log(`[DEVICE_FINGERPRINT] Registered new device for user ${userId}: ${deviceInfo.fingerprint}`);
      
      // Generate security alert for new device
      await this.generateSecurityAlert(userId, {
        type: 'new_device',
        severity: isTrusted ? 'low' : 'medium',
        description: `New ${deviceInfo.deviceType} device (${deviceInfo.browser}) registered`,
        metadata: {
          fingerprint: deviceInfo.fingerprint,
          platform: deviceInfo.platform,
          browser: deviceInfo.browser,
          deviceType: deviceInfo.deviceType,
          ipAddress: deviceInfo.ipAddress,
          isTrusted
        },
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('[DEVICE_FINGERPRINT] Error registering device:', error);
    }
  }

  /**
   * Update device last seen timestamp
   */
  static async updateDeviceActivity(userId: number, fingerprint: string): Promise<void> {
    try {
      const user = await db.select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      
      if (user.length === 0) return;
      
      const currentMetadata = user[0].metadata as any || {};
      if (currentMetadata.devices && currentMetadata.devices[fingerprint]) {
        currentMetadata.devices[fingerprint].lastSeen = new Date().toISOString();
        currentMetadata.devices[fingerprint].verificationCount = 
          (currentMetadata.devices[fingerprint].verificationCount || 0) + 1;
        
        await db.update(users)
          .set({ 
            metadata: currentMetadata,
            updatedAt: new Date()
          })
          .where(eq(users.id, userId));
      }
    } catch (error) {
      console.error('[DEVICE_FINGERPRINT] Error updating device activity:', error);
    }
  }

  /**
   * Get user's known devices
   */
  static async getUserDevices(userId: number): Promise<DeviceFingerprint[]> {
    try {
      const user = await db.select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      
      if (user.length === 0) return [];
      
      const currentMetadata = user[0].metadata as any || {};
      const devices = currentMetadata.devices || {};
      
      return Object.entries(devices).map(([fingerprint, data]: [string, any]) => ({
        id: fingerprint,
        userId,
        deviceInfo: data.deviceInfo,
        firstSeen: new Date(data.firstSeen),
        lastSeen: new Date(data.lastSeen),
        isTrusted: data.isTrusted || false,
        isActive: data.isActive !== false,
        locationCount: data.locationCount || 0,
        verificationCount: data.verificationCount || 0
      }));
    } catch (error) {
      console.error('[DEVICE_FINGERPRINT] Error getting user devices:', error);
      return [];
    }
  }

  /**
   * Check for suspicious activity patterns
   */
  static async detectSuspiciousActivity(
    userId: number, 
    deviceInfo: DeviceInfo, 
    location?: { latitude: number; longitude: number }
  ): Promise<SuspiciousActivity[]> {
    const alerts: SuspiciousActivity[] = [];
    
    try {
      const user = await db.select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      
      if (user.length === 0) return alerts;
      
      const currentMetadata = user[0].metadata as any || {};
      const devices = currentMetadata.devices || {};
      
      // Check for new device
      if (!devices[deviceInfo.fingerprint]) {
        alerts.push({
          type: 'new_device',
          severity: 'medium',
          description: `Access from new ${deviceInfo.deviceType} device (${deviceInfo.browser})`,
          metadata: {
            fingerprint: deviceInfo.fingerprint,
            platform: deviceInfo.platform,
            browser: deviceInfo.browser,
            deviceType: deviceInfo.deviceType,
            ipAddress: deviceInfo.ipAddress
          },
          timestamp: new Date()
        });
      }
      
      // Check for location changes (if location provided)
      if (location) {
        const lastLocation = currentMetadata.lastLocation;
        if (lastLocation) {
          const distance = this.calculateDistance(
            location.latitude,
            location.longitude,
            lastLocation.latitude,
            lastLocation.longitude
          );
          
          // If distance is more than 100km in less than 1 hour, flag as suspicious
          const timeDiff = Date.now() - new Date(lastLocation.timestamp).getTime();
          if (distance > 100000 && timeDiff < 3600000) { // 100km in 1 hour
            alerts.push({
              type: 'location_change',
              severity: 'high',
              description: `Impossible travel detected: ${Math.round(distance/1000)}km in ${Math.round(timeDiff/60000)} minutes`,
              metadata: {
                distance: Math.round(distance),
                timeDiff: Math.round(timeDiff/60000),
                fromLocation: lastLocation,
                toLocation: location,
                fingerprint: deviceInfo.fingerprint
              },
              timestamp: new Date()
            });
          }
        }
        
        // Update last location
        currentMetadata.lastLocation = {
          latitude: location.latitude,
          longitude: location.longitude,
          timestamp: new Date().toISOString(),
          fingerprint: deviceInfo.fingerprint
        };
        
        await db.update(users)
          .set({ 
            metadata: currentMetadata,
            updatedAt: new Date()
          })
          .where(eq(users.id, userId));
      }
      
    } catch (error) {
      console.error('[DEVICE_FINGERPRINT] Error detecting suspicious activity:', error);
    }
    
    return alerts;
  }

  /**
   * Calculate distance between two coordinates (in meters)
   */
  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Generate security alert
   */
  private static async generateSecurityAlert(userId: number, activity: SuspiciousActivity): Promise<void> {
    try {
      console.warn(`[SECURITY_ALERT] User ${userId}: ${activity.description}`, {
        type: activity.type,
        severity: activity.severity,
        metadata: activity.metadata,
        timestamp: activity.timestamp
      });
      
      // In a real implementation, you would:
      // - Store alerts in database
      // - Send notifications to managers
      // - Trigger additional security measures
      // - Log to security monitoring system
      
    } catch (error) {
      console.error('[DEVICE_FINGERPRINT] Error generating security alert:', error);
    }
  }

  /**
   * Trust a device (mark as trusted)
   */
  static async trustDevice(userId: number, fingerprint: string): Promise<boolean> {
    try {
      const user = await db.select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      
      if (user.length === 0) return false;
      
      const currentMetadata = user[0].metadata as any || {};
      if (currentMetadata.devices && currentMetadata.devices[fingerprint]) {
        currentMetadata.devices[fingerprint].isTrusted = true;
        
        await db.update(users)
          .set({ 
            metadata: currentMetadata,
            updatedAt: new Date()
          })
          .where(eq(users.id, userId));
        
        console.log(`[DEVICE_FINGERPRINT] Device ${fingerprint} trusted for user ${userId}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[DEVICE_FINGERPRINT] Error trusting device:', error);
      return false;
    }
  }

  /**
   * Remove a device
   */
  static async removeDevice(userId: number, fingerprint: string): Promise<boolean> {
    try {
      const user = await db.select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      
      if (user.length === 0) return false;
      
      const currentMetadata = user[0].metadata as any || {};
      if (currentMetadata.devices && currentMetadata.devices[fingerprint]) {
        delete currentMetadata.devices[fingerprint];
        
        await db.update(users)
          .set({ 
            metadata: currentMetadata,
            updatedAt: new Date()
          })
          .where(eq(users.id, userId));
        
        console.log(`[DEVICE_FINGERPRINT] Device ${fingerprint} removed for user ${userId}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[DEVICE_FINGERPRINT] Error removing device:', error);
      return false;
    }
  }

  /**
   * Get device security summary for user
   */
  static async getDeviceSecuritySummary(userId: number): Promise<{
    totalDevices: number;
    trustedDevices: number;
    recentDevices: number;
    suspiciousActivity: number;
    lastSeen: Date | null;
  }> {
    try {
      const devices = await this.getUserDevices(userId);
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      return {
        totalDevices: devices.length,
        trustedDevices: devices.filter(d => d.isTrusted).length,
        recentDevices: devices.filter(d => d.lastSeen > oneWeekAgo).length,
        suspiciousActivity: 0, // Would be calculated from security alerts
        lastSeen: devices.length > 0 ? new Date(Math.max(...devices.map(d => d.lastSeen.getTime()))) : null
      };
    } catch (error) {
      console.error('[DEVICE_FINGERPRINT] Error getting security summary:', error);
      return {
        totalDevices: 0,
        trustedDevices: 0,
        recentDevices: 0,
        suspiciousActivity: 0,
        lastSeen: null
      };
    }
  }
}
