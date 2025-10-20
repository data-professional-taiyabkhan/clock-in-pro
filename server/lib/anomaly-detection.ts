/**
 * Anomaly Detection Service
 * Detects unusual patterns and suspicious behavior in attendance data
 */

import { db } from '../db';
import { attendanceVerificationLogs, attendanceRecords, users } from '@shared/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';

interface AnomalyPattern {
  type: 'time_anomaly' | 'location_anomaly' | 'frequency_anomaly' | 'behavior_anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  confidence: number; // 0-100
  userId?: number;
  organizationId: number;
  metadata: Record<string, any>;
  timestamp: Date;
}

interface AttendancePattern {
  userId: number;
  averageClockInTime: string;
  averageClockOutTime: string;
  typicalDays: string[]; // ['monday', 'tuesday', etc.]
  typicalLocations: Array<{ latitude: number; longitude: number; count: number }>;
  averageShiftDuration: number; // in minutes
  totalVerifications: number;
  successRate: number;
}

interface SecurityMetrics {
  failedAttempts24h: number;
  pinUsage24h: number;
  newDevices24h: number;
  unusualLocations24h: number;
  timeAnomalies24h: number;
  riskScore: number; // 0-100
}

export class AnomalyDetection {
  /**
   * Detect time-based anomalies
   */
  static async detectTimeAnomalies(
    organizationId: number, 
    hours: number = 24
  ): Promise<AnomalyPattern[]> {
    const anomalies: AnomalyPattern[] = [];
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    try {
      // Get recent attendance records
      const recentRecords = await db
        .select()
        .from(attendanceRecords)
        .innerJoin(users, eq(attendanceRecords.userId, users.id))
        .where(
          and(
            eq(attendanceRecords.organizationId, organizationId),
            gte(attendanceRecords.clockInTime, since)
          )
        );
      
      // Group by user to analyze patterns
      const userPatterns = new Map<number, any[]>();
      
      for (const record of recentRecords) {
        const userId = record.attendance_records.userId;
        if (!userPatterns.has(userId)) {
          userPatterns.set(userId, []);
        }
        userPatterns.get(userId)!.push(record.attendance_records);
      }
      
      // Analyze each user's pattern
      for (const [userId, records] of userPatterns.entries()) {
        const patterns = await this.getUserAttendancePattern(userId);
        
        for (const record of records) {
          const clockInHour = new Date(record.clockInTime).getHours();
          const dayOfWeek = new Date(record.clockInTime).getDay();
          
          // Check for unusual clock-in time
          const typicalClockInHour = parseInt(patterns.averageClockInTime.split(':')[0]);
          const timeDifference = Math.abs(clockInHour - typicalClockInHour);
          
          if (timeDifference > 2) { // More than 2 hours difference
            const severity = timeDifference > 4 ? 'high' : timeDifference > 3 ? 'medium' : 'low';
            
            anomalies.push({
              type: 'time_anomaly',
              severity,
              description: `Unusual clock-in time: ${clockInHour}:00 (typical: ${typicalClockInHour}:00)`,
              confidence: Math.min(95, timeDifference * 15),
              userId,
              organizationId,
              metadata: {
                clockInTime: record.clockInTime,
                typicalTime: patterns.averageClockInTime,
                timeDifference,
                dayOfWeek
              },
              timestamp: new Date(record.clockInTime)
            });
          }
          
          // Check for unusual day
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const currentDay = dayNames[dayOfWeek];
          
          if (!patterns.typicalDays.includes(currentDay)) {
            anomalies.push({
              type: 'time_anomaly',
              severity: 'medium',
              description: `Unusual work day: ${currentDay}`,
              confidence: 80,
              userId,
              organizationId,
              metadata: {
                clockInTime: record.clockInTime,
                unusualDay: currentDay,
                typicalDays: patterns.typicalDays
              },
              timestamp: new Date(record.clockInTime)
            });
          }
        }
      }
      
    } catch (error) {
      console.error('[ANOMALY_DETECTION] Error detecting time anomalies:', error);
    }
    
    return anomalies;
  }

  /**
   * Detect location-based anomalies
   */
  static async detectLocationAnomalies(
    organizationId: number, 
    hours: number = 24
  ): Promise<AnomalyPattern[]> {
    const anomalies: AnomalyPattern[] = [];
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    try {
      // Get recent verification logs with location data
      const recentLogs = await db
        .select()
        .from(attendanceVerificationLogs)
        .innerJoin(users, eq(attendanceVerificationLogs.userId, users.id))
        .where(
          and(
            eq(attendanceVerificationLogs.organizationId, organizationId),
            gte(attendanceVerificationLogs.attemptTime, since),
            sql`${attendanceVerificationLogs.locationLatitude} IS NOT NULL`,
            sql`${attendanceVerificationLogs.locationLongitude} IS NOT NULL`
          )
        );
      
      // Group by user
      const userLocations = new Map<number, Array<{ lat: number; lon: number; timestamp: Date }>>();
      
      for (const log of recentLogs) {
        const userId = log.attendance_verification_logs.userId;
        const lat = log.attendance_verification_logs.locationLatitude!;
        const lon = log.attendance_verification_logs.locationLongitude!;
        
        if (!userLocations.has(userId)) {
          userLocations.set(userId, []);
        }
        
        userLocations.get(userId)!.push({
          lat,
          lon,
          timestamp: new Date(log.attendance_verification_logs.attemptTime)
        });
      }
      
      // Analyze location patterns for each user
      for (const [userId, locations] of userLocations.entries()) {
        const patterns = await this.getUserAttendancePattern(userId);
        
        for (const location of locations) {
          // Check if location is significantly different from typical locations
          const isUnusual = patterns.typicalLocations.every(typical => {
            const distance = this.calculateDistance(
              location.lat,
              location.lon,
              typical.latitude,
              typical.longitude
            );
            return distance > 5000; // More than 5km from any typical location
          });
          
          if (isUnusual) {
            const closestTypical = patterns.typicalLocations.reduce((closest, typical) => {
              const distance = this.calculateDistance(
                location.lat,
                location.lon,
                typical.latitude,
                typical.longitude
              );
              return distance < closest.distance ? { ...typical, distance } : closest;
            }, { latitude: 0, longitude: 0, distance: Infinity });
            
            const severity = closestTypical.distance > 50000 ? 'high' : 'medium'; // 50km threshold
            
            anomalies.push({
              type: 'location_anomaly',
              severity,
              description: `Unusual location: ${Math.round(closestTypical.distance/1000)}km from typical work location`,
              confidence: Math.min(95, closestTypical.distance / 1000 * 2),
              userId,
              organizationId,
              metadata: {
                currentLocation: { lat: location.lat, lon: location.lon },
                closestTypicalLocation: closestTypical,
                distance: Math.round(closestTypical.distance),
                timestamp: location.timestamp
              },
              timestamp: location.timestamp
            });
          }
        }
      }
      
    } catch (error) {
      console.error('[ANOMALY_DETECTION] Error detecting location anomalies:', error);
    }
    
    return anomalies;
  }

  /**
   * Detect frequency-based anomalies
   */
  static async detectFrequencyAnomalies(
    organizationId: number, 
    hours: number = 24
  ): Promise<AnomalyPattern[]> {
    const anomalies: AnomalyPattern[] = [];
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    try {
      // Get verification attempts grouped by user
      const userAttempts = await db
        .select({
          userId: attendanceVerificationLogs.userId,
          attemptCount: sql<number>`COUNT(*)`,
          failureCount: sql<number>`COUNT(CASE WHEN ${attendanceVerificationLogs.success} = false THEN 1 END)`,
          pinUsage: sql<number>`COUNT(CASE WHEN ${attendanceVerificationLogs.verificationType} = 'pin' THEN 1 END)`
        })
        .from(attendanceVerificationLogs)
        .where(
          and(
            eq(attendanceVerificationLogs.organizationId, organizationId),
            gte(attendanceVerificationLogs.attemptTime, since)
          )
        )
        .groupBy(attendanceVerificationLogs.userId);
      
      for (const userAttempt of userAttempts) {
        const patterns = await this.getUserAttendancePattern(userAttempt.userId);
        
        // Check for excessive verification attempts
        if (userAttempt.attemptCount > 10) { // More than 10 attempts in 24h
          anomalies.push({
            type: 'frequency_anomaly',
            severity: userAttempt.attemptCount > 20 ? 'high' : 'medium',
            description: `Excessive verification attempts: ${userAttempt.attemptCount} in ${hours}h`,
            confidence: Math.min(95, userAttempt.attemptCount * 5),
            userId: userAttempt.userId,
            organizationId,
            metadata: {
              attemptCount: userAttempt.attemptCount,
              failureCount: userAttempt.failureCount,
              pinUsage: userAttempt.pinUsage,
              timeWindow: hours
            },
            timestamp: new Date()
          });
        }
        
        // Check for high failure rate
        const failureRate = (userAttempt.failureCount / userAttempt.attemptCount) * 100;
        if (failureRate > 50 && userAttempt.attemptCount > 3) {
          anomalies.push({
            type: 'frequency_anomaly',
            severity: failureRate > 80 ? 'high' : 'medium',
            description: `High failure rate: ${failureRate.toFixed(1)}% (${userAttempt.failureCount}/${userAttempt.attemptCount})`,
            confidence: Math.min(95, failureRate),
            userId: userAttempt.userId,
            organizationId,
            metadata: {
              failureRate,
              attemptCount: userAttempt.attemptCount,
              failureCount: userAttempt.failureCount,
              typicalSuccessRate: patterns.successRate
            },
            timestamp: new Date()
          });
        }
        
        // Check for unusual PIN usage
        if (userAttempt.pinUsage > 0) {
          const pinUsageRate = (userAttempt.pinUsage / userAttempt.attemptCount) * 100;
          if (pinUsageRate > 30) { // More than 30% PIN usage
            anomalies.push({
              type: 'frequency_anomaly',
              severity: pinUsageRate > 60 ? 'high' : 'medium',
              description: `Unusual PIN usage: ${pinUsageRate.toFixed(1)}% of attempts`,
              confidence: Math.min(95, pinUsageRate),
              userId: userAttempt.userId,
              organizationId,
              metadata: {
                pinUsageRate,
                pinUsage: userAttempt.pinUsage,
                totalAttempts: userAttempt.attemptCount
              },
              timestamp: new Date()
            });
          }
        }
      }
      
    } catch (error) {
      console.error('[ANOMALY_DETECTION] Error detecting frequency anomalies:', error);
    }
    
    return anomalies;
  }

  /**
   * Detect behavioral anomalies
   */
  static async detectBehaviorAnomalies(
    organizationId: number, 
    hours: number = 24
  ): Promise<AnomalyPattern[]> {
    const anomalies: AnomalyPattern[] = [];
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    try {
      // Get recent verification logs with metadata
      const recentLogs = await db
        .select()
        .from(attendanceVerificationLogs)
        .innerJoin(users, eq(attendanceVerificationLogs.userId, users.id))
        .where(
          and(
            eq(attendanceVerificationLogs.organizationId, organizationId),
            gte(attendanceVerificationLogs.attemptTime, since)
          )
        );
      
      // Group by user and analyze patterns
      const userBehaviors = new Map<number, any[]>();
      
      for (const log of recentLogs) {
        const userId = log.attendance_verification_logs.userId;
        if (!userBehaviors.has(userId)) {
          userBehaviors.set(userId, []);
        }
        userBehaviors.get(userId)!.push(log.attendance_verification_logs);
      }
      
      // Analyze behavior patterns
      for (const [userId, logs] of userBehaviors.entries()) {
        // Check for rapid successive attempts (possible automated attack)
        const rapidAttempts = logs.filter((log, index) => {
          if (index === 0) return false;
          const timeDiff = new Date(log.attemptTime).getTime() - new Date(logs[index - 1].attemptTime).getTime();
          return timeDiff < 5000; // Less than 5 seconds between attempts
        });
        
        if (rapidAttempts.length > 2) {
          anomalies.push({
            type: 'behavior_anomaly',
            severity: 'high',
            description: `Rapid successive verification attempts detected (${rapidAttempts.length + 1} attempts)`,
            confidence: 90,
            userId,
            organizationId,
            metadata: {
              rapidAttempts: rapidAttempts.length + 1,
              timeWindow: '5 seconds',
              deviceInfo: rapidAttempts[0]?.deviceInfo
            },
            timestamp: new Date()
          });
        }
        
        // Check for consistent failure patterns
        const consecutiveFailures = this.findConsecutiveFailures(logs);
        if (consecutiveFailures > 5) {
          anomalies.push({
            type: 'behavior_anomaly',
            severity: 'medium',
            description: `Consecutive verification failures: ${consecutiveFailures}`,
            confidence: Math.min(95, consecutiveFailures * 15),
            userId,
            organizationId,
            metadata: {
              consecutiveFailures,
              recentLogs: logs.slice(-consecutiveFailures).map(l => ({
                time: l.attemptTime,
                type: l.verificationType,
                success: l.success,
                reason: l.failureReason
              }))
            },
            timestamp: new Date()
          });
        }
      }
      
    } catch (error) {
      console.error('[ANOMALY_DETECTION] Error detecting behavior anomalies:', error);
    }
    
    return anomalies;
  }

  /**
   * Get user's typical attendance pattern
   */
  private static async getUserAttendancePattern(userId: number): Promise<AttendancePattern> {
    try {
      // Get user's attendance history (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const records = await db
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.userId, userId),
            gte(attendanceRecords.clockInTime, thirtyDaysAgo)
          )
        );
      
      // Calculate average clock-in/out times
      let totalClockInMinutes = 0;
      let totalClockOutMinutes = 0;
      let totalShiftDuration = 0;
      const daysOfWeek = new Set<string>();
      const locations = new Map<string, number>();
      
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      
      for (const record of records) {
        const clockInTime = new Date(record.clockInTime);
        const clockOutTime = record.clockOutTime ? new Date(record.clockOutTime) : null;
        
        totalClockInMinutes += clockInTime.getHours() * 60 + clockInTime.getMinutes();
        daysOfWeek.add(dayNames[clockInTime.getDay()]);
        
        if (clockOutTime) {
          totalClockOutMinutes += clockOutTime.getHours() * 60 + clockOutTime.getMinutes();
          const shiftDuration = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60);
          totalShiftDuration += shiftDuration;
        }
        
        // Track locations (if available)
        if (record.locationId) {
          const locationKey = `location_${record.locationId}`;
          locations.set(locationKey, (locations.get(locationKey) || 0) + 1);
        }
      }
      
      const recordCount = records.length;
      const avgClockInHour = Math.floor(totalClockInMinutes / recordCount / 60);
      const avgClockInMinute = Math.floor((totalClockInMinutes / recordCount) % 60);
      const avgClockOutHour = Math.floor(totalClockOutMinutes / recordCount / 60);
      const avgClockOutMinute = Math.floor((totalClockOutMinutes / recordCount) % 60);
      
      // Get verification statistics
      const verifications = await db
        .select({
          total: sql<number>`COUNT(*)`,
          successful: sql<number>`COUNT(CASE WHEN ${attendanceVerificationLogs.success} = true THEN 1 END)`
        })
        .from(attendanceVerificationLogs)
        .where(
          and(
            eq(attendanceVerificationLogs.userId, userId),
            gte(attendanceVerificationLogs.attemptTime, thirtyDaysAgo)
          )
        );
      
      const totalVerifications = verifications[0]?.total || 0;
      const successfulVerifications = verifications[0]?.successful || 0;
      const successRate = totalVerifications > 0 ? (successfulVerifications / totalVerifications) * 100 : 100;
      
      return {
        userId,
        averageClockInTime: `${avgClockInHour.toString().padStart(2, '0')}:${avgClockInMinute.toString().padStart(2, '0')}`,
        averageClockOutTime: `${avgClockOutHour.toString().padStart(2, '0')}:${avgClockOutMinute.toString().padStart(2, '0')}`,
        typicalDays: Array.from(daysOfWeek),
        typicalLocations: Array.from(locations.entries()).map(([key, count]) => ({
          latitude: 0, // Would need to join with locations table
          longitude: 0,
          count
        })),
        averageShiftDuration: recordCount > 0 ? totalShiftDuration / recordCount : 0,
        totalVerifications,
        successRate
      };
      
    } catch (error) {
      console.error('[ANOMALY_DETECTION] Error getting user attendance pattern:', error);
      return {
        userId,
        averageClockInTime: '09:00',
        averageClockOutTime: '17:00',
        typicalDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        typicalLocations: [],
        averageShiftDuration: 480,
        totalVerifications: 0,
        successRate: 100
      };
    }
  }

  /**
   * Find consecutive failures in verification logs
   */
  private static findConsecutiveFailures(logs: any[]): number {
    let maxConsecutive = 0;
    let currentConsecutive = 0;
    
    for (const log of logs) {
      if (!log.success) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 0;
      }
    }
    
    return maxConsecutive;
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
   * Generate security metrics for organization
   */
  static async generateSecurityMetrics(organizationId: number): Promise<SecurityMetrics> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    try {
      // Get failed attempts
      const failedAttempts = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(attendanceVerificationLogs)
        .where(
          and(
            eq(attendanceVerificationLogs.organizationId, organizationId),
            eq(attendanceVerificationLogs.success, false),
            gte(attendanceVerificationLogs.attemptTime, since)
          )
        );
      
      // Get PIN usage
      const pinUsage = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(attendanceVerificationLogs)
        .where(
          and(
            eq(attendanceVerificationLogs.organizationId, organizationId),
            eq(attendanceVerificationLogs.verificationType, 'pin'),
            gte(attendanceVerificationLogs.attemptTime, since)
          )
        );
      
      // Calculate risk score based on various factors
      const failedCount = failedAttempts[0]?.count || 0;
      const pinCount = pinUsage[0]?.count || 0;
      
      let riskScore = 0;
      riskScore += Math.min(30, failedCount * 3); // Up to 30 points for failures
      riskScore += Math.min(20, pinCount * 2); // Up to 20 points for PIN usage
      
      // Get anomaly counts
      const timeAnomalies = await this.detectTimeAnomalies(organizationId, 24);
      const locationAnomalies = await this.detectLocationAnomalies(organizationId, 24);
      const frequencyAnomalies = await this.detectFrequencyAnomalies(organizationId, 24);
      const behaviorAnomalies = await this.detectBehaviorAnomalies(organizationId, 24);
      
      const totalAnomalies = timeAnomalies.length + locationAnomalies.length + 
                           frequencyAnomalies.length + behaviorAnomalies.length;
      
      riskScore += Math.min(50, totalAnomalies * 5); // Up to 50 points for anomalies
      
      return {
        failedAttempts24h: failedCount,
        pinUsage24h: pinCount,
        newDevices24h: 0, // Would be calculated from device fingerprinting
        unusualLocations24h: locationAnomalies.length,
        timeAnomalies24h: timeAnomalies.length,
        riskScore: Math.min(100, riskScore)
      };
      
    } catch (error) {
      console.error('[ANOMALY_DETECTION] Error generating security metrics:', error);
      return {
        failedAttempts24h: 0,
        pinUsage24h: 0,
        newDevices24h: 0,
        unusualLocations24h: 0,
        timeAnomalies24h: 0,
        riskScore: 0
      };
    }
  }

  /**
   * Run comprehensive anomaly detection
   */
  static async runAnomalyDetection(organizationId: number): Promise<AnomalyPattern[]> {
    const allAnomalies: AnomalyPattern[] = [];
    
    try {
      // Run all detection methods
      const [timeAnomalies, locationAnomalies, frequencyAnomalies, behaviorAnomalies] = await Promise.all([
        this.detectTimeAnomalies(organizationId),
        this.detectLocationAnomalies(organizationId),
        this.detectFrequencyAnomalies(organizationId),
        this.detectBehaviorAnomalies(organizationId)
      ]);
      
      allAnomalies.push(...timeAnomalies, ...locationAnomalies, ...frequencyAnomalies, ...behaviorAnomalies);
      
      // Sort by severity and confidence
      allAnomalies.sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
        if (severityDiff !== 0) return severityDiff;
        return b.confidence - a.confidence;
      });
      
      console.log(`[ANOMALY_DETECTION] Found ${allAnomalies.length} anomalies for organization ${organizationId}`);
      
    } catch (error) {
      console.error('[ANOMALY_DETECTION] Error running anomaly detection:', error);
    }
    
    return allAnomalies;
  }
}
