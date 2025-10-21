import {
  users,
  attendanceRecords,
  locations,
  employeeInvitations,
  employeeLocations,
  organizations,
  attendanceVerificationLogs,
  type User,
  type InsertUser,
  type AttendanceRecord,
  type InsertAttendanceRecord,
  type Location,
  type InsertLocation,
  type EmployeeInvitation,
  type InsertInvitation,
  type EmployeeLocation,
  type InsertEmployeeLocation,
  type Organization,
  type InsertOrganization,
  type AttendanceVerificationLog,
  type InsertAttendanceVerificationLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";
import session from "express-session";
import MemoryStore from "memorystore";

const MemoryStoreSession = MemoryStore(session);

export interface IStorage {
  // Organization operations
  createOrganization(org: InsertOrganization): Promise<Organization>;
  getOrganization(id: number): Promise<Organization | undefined>;
  getAllOrganizations(): Promise<Organization[]>;
  updateOrganization(id: number, updates: Partial<Organization>): Promise<Organization>;
  deleteOrganization(id: number): Promise<void>;
  updateOrganizationEmployeeCount(organizationId: number): Promise<void>;
  
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string, organizationId?: number): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserFaceImage(userId: number, faceImageUrl: string): Promise<User>;
  updateUserFaceEmbedding(userId: number, faceImageUrl: string | null | undefined, faceEmbedding: number[]): Promise<User>;
  // updateUserFaceEmbeddingVector(userId: number, faceEmbeddingVector: string): Promise<User>; // temporarily disabled
  updateUserPassword(userId: number, hashedPassword: string): Promise<User>;
  // updateUserPin(userId: number, pinHash: string): Promise<User>; // temporarily disabled
  getAllEmployees(organizationId?: number): Promise<User[]>;
  getAllUsers(organizationId?: number): Promise<User[]>;
  deleteUser(id: number): Promise<void>;
  
  // Attendance operations
  createAttendanceRecord(record: InsertAttendanceRecord): Promise<AttendanceRecord>;
  updateAttendanceRecord(id: number, updates: Partial<AttendanceRecord>): Promise<AttendanceRecord>;
  getUserAttendanceRecords(userId: number, limit?: number): Promise<AttendanceRecord[]>;
  getTodayAttendanceRecord(userId: number, date: string): Promise<AttendanceRecord | undefined>;
  getAllAttendanceRecords(organizationId?: number, limit?: number): Promise<AttendanceRecord[]>;
  
  // Location operations
  createLocation(location: InsertLocation): Promise<Location>;
  getActiveLocations(organizationId?: number): Promise<Location[]>;
  getLocationByPostcode(postcode: string, organizationId?: number): Promise<Location | undefined>;
  updateLocation(id: number, updates: Partial<Location>): Promise<Location>;
  deleteLocation(id: number): Promise<void>;
  
  // Invitation operations
  createInvitation(invitation: InsertInvitation & { token: string }): Promise<EmployeeInvitation>;
  getInvitationByToken(token: string): Promise<EmployeeInvitation | undefined>;
  markInvitationUsed(id: number): Promise<EmployeeInvitation>;
  getActiveInvitations(organizationId?: number): Promise<EmployeeInvitation[]>;
  
  // Employee location operations
  assignEmployeeToLocation(assignment: InsertEmployeeLocation): Promise<EmployeeLocation>;
  removeEmployeeFromLocation(userId: number, locationId: number): Promise<void>;
  getEmployeeLocations(userId: number): Promise<Location[]>;
  getUsersAtLocation(locationId: number): Promise<User[]>;
  getAllEmployeeLocationAssignments(organizationId?: number): Promise<(EmployeeLocation & { user: User; location: Location })[]>;
  
  // Audit logging operations
  createVerificationLog(log: InsertAttendanceVerificationLog): Promise<AttendanceVerificationLog>;
  getUserVerificationLogs(userId: number, organizationId: number, limit?: number): Promise<AttendanceVerificationLog[]>;
  getOrganizationVerificationLogs(organizationId: number, limit?: number): Promise<AttendanceVerificationLog[]>;
  
  sessionStore: any;
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new MemoryStoreSession({
      checkPeriod: 86400000, // 24 hours
    });
  }

  // Organization operations
  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [organization] = await db
      .insert(organizations)
      .values(org)
      .returning();
    return organization;
  }

  async getOrganization(id: number): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org || undefined;
  }

  async getAllOrganizations(): Promise<Organization[]> {
    const orgs = await db.select().from(organizations).orderBy(desc(organizations.createdAt));
    
    // Update current employee count for each organization
    const updatedOrgs = await Promise.all(
      orgs.map(async (org) => {
        const result = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(users)
          .where(and(
            eq(users.organizationId, org.id),
            eq(users.isActive, true)
          ));
        
        const count = Number(result[0].count);
        
        // Update the database with the current count
        await db
          .update(organizations)
          .set({ currentEmployees: count })
          .where(eq(organizations.id, org.id));
        
        return { ...org, currentEmployees: count };
      })
    );
    
    return updatedOrgs;
  }

  async updateOrganization(id: number, updates: Partial<Organization>): Promise<Organization> {
    // Add updatedAt timestamp
    const updateData = {
      ...updates,
      updatedAt: new Date()
    };
    
    const [org] = await db
      .update(organizations)
      .set(updateData)
      .where(eq(organizations.id, id))
      .returning();
    return org;
  }

  async deleteOrganization(id: number): Promise<void> {
    // Delete all related data in the correct order to avoid foreign key constraint violations
    // First, find all users in the organization to clean up references
    const organizationUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.organizationId, id));
    
    const userIds = organizationUsers.map(u => u.id);
    
    // Delete all data that references these users
    for (const userId of userIds) {
      // Delete attendance records where user is referenced
      await db.delete(attendanceRecords).where(eq(attendanceRecords.userId, userId));
      await db.delete(attendanceRecords).where(eq(attendanceRecords.manuallyApprovedBy, userId));
      
      // Delete employee locations where user is referenced
      await db.delete(employeeLocations).where(eq(employeeLocations.userId, userId));
      await db.delete(employeeLocations).where(eq(employeeLocations.assignedById, userId));
      
      // Delete invitations where user is referenced
      await db.delete(employeeInvitations).where(eq(employeeInvitations.invitedBy, userId));
    }
    
    // Delete organization-level data
    await db.delete(attendanceRecords).where(eq(attendanceRecords.organizationId, id));
    await db.delete(employeeLocations).where(eq(employeeLocations.organizationId, id));
    await db.delete(employeeInvitations).where(eq(employeeInvitations.organizationId, id));
    await db.delete(locations).where(eq(locations.organizationId, id));
    
    // Delete all users in the organization
    await db.delete(users).where(eq(users.organizationId, id));
    
    // Finally delete the organization itself
    await db.delete(organizations).where(eq(organizations.id, id));
  }

  async updateOrganizationEmployeeCount(organizationId: number): Promise<void> {
    // Count only non-admin users (employees and managers)
    const count = await db.select({ count: sql<number>`COUNT(*)` })
      .from(users)
      .where(and(
        eq(users.organizationId, organizationId),
        eq(users.isActive, true),
        sql`${users.role} != 'admin'`
      ));
    
    await db.update(organizations)
      .set({ employeeCount: count[0].count })
      .where(eq(organizations.id, organizationId));
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string, organizationId?: number): Promise<User | undefined> {
    const conditions = [eq(users.email, email)];
    if (organizationId !== undefined) {
      conditions.push(eq(users.organizationId, organizationId));
    }
    const [user] = await db.select().from(users).where(and(...conditions));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUserFaceImage(userId: number, faceImageUrl: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ faceImageUrl })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserFaceEmbedding(userId: number, faceImageUrl: string | null | undefined, faceEmbedding: number[]): Promise<User> {
    const updateData: Record<string, unknown> = {
      faceEmbedding,
    };

    if (typeof faceImageUrl !== "undefined") {
      updateData.faceImageUrl = faceImageUrl;
    }

    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserPassword(userId: number, hashedPassword: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getAllEmployees(organizationId?: number): Promise<User[]> {
    const conditions = [eq(users.role, "employee")];
    if (organizationId !== undefined) {
      conditions.push(eq(users.organizationId, organizationId));
    }
    return await db
      .select()
      .from(users)
      .where(and(...conditions))
      .orderBy(desc(users.createdAt));
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getAllUsers(organizationId?: number): Promise<User[]> {
    if (organizationId !== undefined) {
      return await db
        .select()
        .from(users)
        .where(eq(users.organizationId, organizationId))
        .orderBy(desc(users.createdAt));
    }
    return await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // Attendance operations
  async createAttendanceRecord(record: InsertAttendanceRecord): Promise<AttendanceRecord> {
    const [attendanceRecord] = await db
      .insert(attendanceRecords)
      .values(record)
      .returning();
    return attendanceRecord;
  }

  async updateAttendanceRecord(id: number, updates: Partial<AttendanceRecord>): Promise<AttendanceRecord> {
    const [attendanceRecord] = await db
      .update(attendanceRecords)
      .set(updates)
      .where(eq(attendanceRecords.id, id))
      .returning();
    return attendanceRecord;
  }

  async getUserAttendanceRecords(userId: number, limit: number = 10): Promise<AttendanceRecord[]> {
    return await db
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.userId, userId))
      .orderBy(desc(attendanceRecords.createdAt))
      .limit(limit);
  }

  async getTodayAttendanceRecord(userId: number, date: string): Promise<AttendanceRecord | undefined> {
    const [record] = await db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.userId, userId), eq(attendanceRecords.date, date)));
    return record || undefined;
  }

  async getAllAttendanceRecords(limit: number = 50, organizationId?: number): Promise<AttendanceRecord[]> {
    if (organizationId !== undefined) {
      return await db
        .select()
        .from(attendanceRecords)
        .where(eq(attendanceRecords.organizationId, organizationId))
        .orderBy(desc(attendanceRecords.createdAt))
        .limit(limit);
    }
    return await db
      .select()
      .from(attendanceRecords)
      .orderBy(desc(attendanceRecords.createdAt))
      .limit(limit);
  }

  // Location operations
  async createLocation(location: InsertLocation): Promise<Location> {
    // Convert coordinates to strings as required by schema
    const locationData = {
      ...location,
      latitude: location.latitude?.toString(),
      longitude: location.longitude?.toString()
    };
    
    const [newLocation] = await db
      .insert(locations)
      .values([locationData])
      .returning();
    return newLocation;
  }

  async getActiveLocations(organizationId?: number): Promise<Location[]> {
    const conditions = [eq(locations.isActive, true)];
    if (organizationId !== undefined) {
      conditions.push(eq(locations.organizationId, organizationId));
    }
    return await db
      .select()
      .from(locations)
      .where(and(...conditions))
      .orderBy(desc(locations.createdAt));
  }

  async getLocationByPostcode(postcode: string, organizationId?: number): Promise<Location | undefined> {
    const conditions = [eq(locations.postcode, postcode), eq(locations.isActive, true)];
    if (organizationId !== undefined) {
      conditions.push(eq(locations.organizationId, organizationId));
    }
    const [location] = await db
      .select()
      .from(locations)
      .where(and(...conditions));
    return location || undefined;
  }

  async updateLocation(id: number, updates: Partial<Location>): Promise<Location> {
    const [location] = await db
      .update(locations)
      .set(updates)
      .where(eq(locations.id, id))
      .returning();
    return location;
  }

  async deleteLocation(id: number): Promise<void> {
    // First remove all employee assignments for this location
    await db.delete(employeeLocations)
      .where(eq(employeeLocations.locationId, id));
    
    // Update attendance records to remove location reference
    await db.update(attendanceRecords)
      .set({ locationId: null })
      .where(eq(attendanceRecords.locationId, id));
    
    // Then delete the location
    await db.delete(locations)
      .where(eq(locations.id, id));
  }

  // Invitation operations
  async createInvitation(invitation: InsertInvitation & { token: string }): Promise<EmployeeInvitation> {
    const [newInvitation] = await db
      .insert(employeeInvitations)
      .values(invitation)
      .returning();
    return newInvitation;
  }

  async getInvitationByToken(token: string): Promise<EmployeeInvitation | undefined> {
    const [invitation] = await db
      .select()
      .from(employeeInvitations)
      .where(and(eq(employeeInvitations.token, token), eq(employeeInvitations.used, false)));
    return invitation || undefined;
  }

  async markInvitationUsed(id: number): Promise<EmployeeInvitation> {
    const [invitation] = await db
      .update(employeeInvitations)
      .set({ used: true })
      .where(eq(employeeInvitations.id, id))
      .returning();
    return invitation;
  }

  async getActiveInvitations(organizationId?: number): Promise<EmployeeInvitation[]> {
    const conditions = [eq(employeeInvitations.used, false)];
    if (organizationId !== undefined) {
      conditions.push(eq(employeeInvitations.organizationId, organizationId));
    }
    return await db
      .select()
      .from(employeeInvitations)
      .where(and(...conditions))
      .orderBy(desc(employeeInvitations.createdAt));
  }

  // Employee location operations
  async assignEmployeeToLocation(assignment: InsertEmployeeLocation & { organizationId?: number }): Promise<EmployeeLocation> {
    const [employeeLocation] = await db
      .insert(employeeLocations)
      .values(assignment)
      .onConflictDoNothing()
      .returning();
    return employeeLocation;
  }

  async removeEmployeeFromLocation(userId: number, locationId: number): Promise<void> {
    await db
      .delete(employeeLocations)
      .where(and(
        eq(employeeLocations.userId, userId),
        eq(employeeLocations.locationId, locationId)
      ));
  }

  async getEmployeeLocations(userId: number): Promise<Location[]> {
    const result = await db
      .select({
        id: locations.id,
        name: locations.name,
        postcode: locations.postcode,
        address: locations.address,
        latitude: locations.latitude,
        longitude: locations.longitude,
        radiusMeters: locations.radiusMeters,
        isActive: locations.isActive,
        createdAt: locations.createdAt,
      })
      .from(employeeLocations)
      .innerJoin(locations, eq(employeeLocations.locationId, locations.id))
      .where(and(
        eq(employeeLocations.userId, userId),
        eq(locations.isActive, true)
      ));
    
    return result;
  }

  async getUsersAtLocation(locationId: number): Promise<User[]> {
    const result = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        password: users.password,
        role: users.role,
        faceImageUrl: users.faceImageUrl,
        faceEmbedding: users.faceEmbedding,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(employeeLocations)
      .innerJoin(users, eq(employeeLocations.userId, users.id))
      .where(and(
        eq(employeeLocations.locationId, locationId),
        eq(users.isActive, true)
      ));
    
    return result;
  }

  async getAllEmployeeLocationAssignments(organizationId?: number): Promise<(EmployeeLocation & { user: User; location: Location })[]> {
    try {
      const conditions = [
        eq(users.isActive, true),
        eq(locations.isActive, true)
      ];
      
      if (organizationId !== undefined) {
        conditions.push(eq(users.organizationId, organizationId));
        conditions.push(eq(locations.organizationId, organizationId));
      }
      
      const result = await db
        .select()
        .from(employeeLocations)
        .innerJoin(users, eq(employeeLocations.userId, users.id))
        .innerJoin(locations, eq(employeeLocations.locationId, locations.id))
        .where(and(...conditions))
        .orderBy(users.firstName, users.lastName);
      
      return result.map(row => ({
        id: row.employee_locations.id,
        userId: row.employee_locations.userId,
        locationId: row.employee_locations.locationId,
        assignedById: row.employee_locations.assignedById,
        createdAt: row.employee_locations.createdAt,
        user: row.users,
        location: row.locations
      }));
    } catch (error) {
      console.error("Error getting employee location assignments:", error);
      return [];
    }
  }

  // New methods for enhanced security features

  // async updateUserFaceEmbeddingVector(userId: number, faceEmbeddingVector: string): Promise<User> {
  //   const [user] = await db
  //     .update(users)
  //     .set({ 
  //       faceEmbeddingVector,
  //       updatedAt: new Date()
  //     })
  //     .where(eq(users.id, userId))
  //     .returning();
  //   return user;
  // }

  // async updateUserPin(userId: number, pinHash: string): Promise<User> {
  //   const [user] = await db
  //     .update(users)
  //     .set({ 
  //       pinHash,
  //       pinEnabled: true,
  //       updatedAt: new Date()
  //     })
  //     .where(eq(users.id, userId))
  //     .returning();
  //   return user;
  // }

  // Audit logging methods
  async createVerificationLog(log: InsertAttendanceVerificationLog): Promise<AttendanceVerificationLog> {
    const [verificationLog] = await db
      .insert(attendanceVerificationLogs)
      .values(log)
      .returning();
    return verificationLog;
  }

  async getUserVerificationLogs(userId: number, organizationId: number, limit: number = 50): Promise<AttendanceVerificationLog[]> {
    const logs = await db
      .select()
      .from(attendanceVerificationLogs)
      .where(and(
        eq(attendanceVerificationLogs.userId, userId),
        eq(attendanceVerificationLogs.organizationId, organizationId)
      ))
      .orderBy(desc(attendanceVerificationLogs.attemptTime))
      .limit(limit);
    return logs;
  }

  async getOrganizationVerificationLogs(organizationId: number, limit: number = 100): Promise<AttendanceVerificationLog[]> {
    const logs = await db
      .select()
      .from(attendanceVerificationLogs)
      .where(eq(attendanceVerificationLogs.organizationId, organizationId))
      .orderBy(desc(attendanceVerificationLogs.attemptTime))
      .limit(limit);
    return logs;
  }
}

export const storage = new DatabaseStorage();