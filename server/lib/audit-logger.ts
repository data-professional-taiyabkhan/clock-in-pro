/**
 * Audit Logger Service
 * Centralized logging utility for all verification attempts
 */

import { db } from "../db";
import { attendanceVerificationLogs } from "@shared/schema";
import type { InsertAttendanceVerificationLog } from "@shared/schema";
import { eq, and, desc, gte, lte, isNotNull, sql } from "drizzle-orm";

export interface AuditLogData {
  userId: number;
  organizationId: number;
  verificationType: 'face' | 'pin';
  success: boolean;
  faceConfidence?: number;
  livenessScore?: number;
  locationLatitude?: number;
  locationLongitude?: number;
  deviceInfo?: string;
  failureReason?: string;
  metadata?: Record<string, any>;
}

export interface DeviceInfo {
  userAgent?: string;
  ipAddress?: string;
  platform?: string;
  browser?: string;
  deviceType?: string;
}

export class AuditLogger {
  /**
   * Log a verification attempt with comprehensive metadata
   */
  static async logVerificationAttempt(
    data: AuditLogData,
    deviceInfo?: DeviceInfo
  ): Promise<void> {
    try {
      const logEntry: InsertAttendanceVerificationLog = {
        organizationId: data.organizationId,
        userId: data.userId,
        verificationType: data.verificationType,
        success: data.success,
        faceConfidence: data.faceConfidence,
        livenessScore: data.livenessScore,
        locationLatitude: data.locationLatitude,
        locationLongitude: data.locationLongitude,
        deviceInfo: deviceInfo ? JSON.stringify(deviceInfo) : data.deviceInfo,
        failureReason: data.failureReason,
        metadata: data.metadata || {},
      };

      await db.insert(attendanceVerificationLogs).values(logEntry);
      
      console.log(`[AUDIT] ${data.verificationType.toUpperCase()} verification ${data.success ? 'SUCCESS' : 'FAILED'} for user ${data.userId}`, {
        organizationId: data.organizationId,
        confidence: data.faceConfidence,
        livenessScore: data.livenessScore,
        failureReason: data.failureReason
      });
    } catch (error) {
      console.error('[AUDIT] Failed to log verification attempt:', error);
      // Don't throw - audit logging failure shouldn't break the main flow
    }
  }

  /**
   * Log face verification attempt
   */
  static async logFaceVerification(
    userId: number,
    organizationId: number,
    success: boolean,
    options: {
      faceConfidence?: number;
      livenessScore?: number;
      locationLatitude?: number;
      locationLongitude?: number;
      deviceInfo?: DeviceInfo;
      failureReason?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    await this.logVerificationAttempt({
      userId,
      organizationId,
      verificationType: 'face',
      success,
      faceConfidence: options.faceConfidence,
      livenessScore: options.livenessScore,
      locationLatitude: options.locationLatitude,
      locationLongitude: options.locationLongitude,
      deviceInfo: options.deviceInfo ? JSON.stringify(options.deviceInfo) : undefined,
      failureReason: options.failureReason,
      metadata: options.metadata,
    }, options.deviceInfo);
  }

  /**
   * Log PIN verification attempt
   */
  static async logPinVerification(
    userId: number,
    organizationId: number,
    success: boolean,
    options: {
      locationLatitude?: number;
      locationLongitude?: number;
      deviceInfo?: DeviceInfo;
      failureReason?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    await this.logVerificationAttempt({
      userId,
      organizationId,
      verificationType: 'pin',
      success,
      locationLatitude: options.locationLatitude,
      locationLongitude: options.locationLongitude,
      deviceInfo: options.deviceInfo ? JSON.stringify(options.deviceInfo) : undefined,
      failureReason: options.failureReason,
      metadata: options.metadata,
    }, options.deviceInfo);
  }

  /**
   * Extract device info from request headers
   */
  static extractDeviceInfo(req: any): DeviceInfo {
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = req.ip || 
                     req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] || 
                     req.connection?.remoteAddress || 
                     'unknown';

    // Parse user agent for browser and platform info
    const browser = this.parseBrowser(userAgent);
    const platform = this.parsePlatform(userAgent);
    const deviceType = this.parseDeviceType(userAgent);

    return {
      userAgent,
      ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
      platform,
      browser,
      deviceType,
    };
  }

  /**
   * Parse browser from user agent
   */
  private static parseBrowser(userAgent: string): string {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';
    return 'Unknown';
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
   * Get audit logs for a specific user (manager/admin access)
   */
  static async getUserAuditLogs(
    userId: number,
    organizationId: number,
    limit: number = 50,
    offset: number = 0
  ) {
    try {
      const logs = await db
        .select()
        .from(attendanceVerificationLogs)
        .where(
          and(
            eq(attendanceVerificationLogs.userId, userId),
            eq(attendanceVerificationLogs.organizationId, organizationId)
          )
        )
        .orderBy(desc(attendanceVerificationLogs.attemptTime))
        .limit(limit)
        .offset(offset);

      return logs;
    } catch (error) {
      console.error('[AUDIT] Failed to get user audit logs:', error);
      throw error;
    }
  }

  /**
   * Get audit logs for an organization (admin access)
   */
  static async getOrganizationAuditLogs(
    organizationId: number,
    limit: number = 100,
    offset: number = 0,
    filters?: {
      userId?: number;
      verificationType?: 'face' | 'pin';
      success?: boolean;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    try {
      let whereConditions = [eq(attendanceVerificationLogs.organizationId, organizationId)];

      if (filters?.userId) {
        whereConditions.push(eq(attendanceVerificationLogs.userId, filters.userId));
      }

      if (filters?.verificationType) {
        whereConditions.push(eq(attendanceVerificationLogs.verificationType, filters.verificationType));
      }

      if (filters?.success !== undefined) {
        whereConditions.push(eq(attendanceVerificationLogs.success, filters.success));
      }

      if (filters?.startDate) {
        whereConditions.push(gte(attendanceVerificationLogs.attemptTime, filters.startDate));
      }

      if (filters?.endDate) {
        whereConditions.push(lte(attendanceVerificationLogs.attemptTime, filters.endDate));
      }

      const logs = await db
        .select()
        .from(attendanceVerificationLogs)
        .where(and(...whereConditions))
        .orderBy(desc(attendanceVerificationLogs.attemptTime))
        .limit(limit)
        .offset(offset);

      return logs;
    } catch (error) {
      console.error('[AUDIT] Failed to get organization audit logs:', error);
      throw error;
    }
  }

  /**
   * Get failed verification attempts for security monitoring
   */
  static async getFailedAttempts(
    organizationId: number,
    hours: number = 24
  ) {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const failedAttempts = await db
        .select()
        .from(attendanceVerificationLogs)
        .where(
          and(
            eq(attendanceVerificationLogs.organizationId, organizationId),
            eq(attendanceVerificationLogs.success, false),
            gte(attendanceVerificationLogs.attemptTime, since)
          )
        )
        .orderBy(desc(attendanceVerificationLogs.attemptTime));

      return failedAttempts;
    } catch (error) {
      console.error('[AUDIT] Failed to get failed attempts:', error);
      throw error;
    }
  }

  /**
   * Get PIN usage statistics for manager notifications
   */
  static async getPinUsageStats(
    organizationId: number,
    hours: number = 24
  ) {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const pinUsage = await db
        .select()
        .from(attendanceVerificationLogs)
        .where(
          and(
            eq(attendanceVerificationLogs.organizationId, organizationId),
            eq(attendanceVerificationLogs.verificationType, 'pin'),
            eq(attendanceVerificationLogs.success, true),
            gte(attendanceVerificationLogs.attemptTime, since)
          )
        )
        .orderBy(desc(attendanceVerificationLogs.attemptTime));

      return pinUsage;
    } catch (error) {
      console.error('[AUDIT] Failed to get PIN usage stats:', error);
      throw error;
    }
  }

  /**
   * Generate security alerts based on patterns
   */
  static async generateSecurityAlerts(organizationId: number): Promise<{
    multipleFailures: any[];
    suspiciousLocations: any[];
    pinUsage: any[];
  }> {
    try {
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Get multiple failures from same user/IP
      const multipleFailures = await db
        .select({
          userId: attendanceVerificationLogs.userId,
          deviceInfo: attendanceVerificationLogs.deviceInfo,
          failureCount: sql<number>`COUNT(*)`,
          lastAttempt: sql<Date>`MAX(${attendanceVerificationLogs.attemptTime})`,
        })
        .from(attendanceVerificationLogs)
        .where(
          and(
            eq(attendanceVerificationLogs.organizationId, organizationId),
            eq(attendanceVerificationLogs.success, false),
            gte(attendanceVerificationLogs.attemptTime, last24Hours)
          )
        )
        .groupBy(attendanceVerificationLogs.userId, attendanceVerificationLogs.deviceInfo)
        .having(sql`COUNT(*) >= 3`);

      // Get PIN usage (manager notification)
      const pinUsage = await this.getPinUsageStats(organizationId, 24);

      // Get suspicious location patterns (same user, very different locations)
      const suspiciousLocations = await db
        .select({
          userId: attendanceVerificationLogs.userId,
          locationCount: sql<number>`COUNT(DISTINCT ${attendanceVerificationLogs.locationLatitude}, ${attendanceVerificationLogs.locationLongitude})`,
          lastAttempt: sql<Date>`MAX(${attendanceVerificationLogs.attemptTime})`,
        })
        .from(attendanceVerificationLogs)
        .where(
          and(
            eq(attendanceVerificationLogs.organizationId, organizationId),
            gte(attendanceVerificationLogs.attemptTime, last24Hours),
            isNotNull(attendanceVerificationLogs.locationLatitude),
            isNotNull(attendanceVerificationLogs.locationLongitude)
          )
        )
        .groupBy(attendanceVerificationLogs.userId)
        .having(sql`COUNT(DISTINCT ${attendanceVerificationLogs.locationLatitude}, ${attendanceVerificationLogs.locationLongitude}) > 2`);

      return {
        multipleFailures,
        suspiciousLocations,
        pinUsage,
      };
    } catch (error) {
      console.error('[AUDIT] Failed to generate security alerts:', error);
      return {
        multipleFailures: [],
        suspiciousLocations: [],
        pinUsage: [],
      };
    }
  }
}

