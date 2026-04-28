import {
  users,
  attendanceRecords,
  locations,
  employeeInvitations,
  employeeLocations,
  organizations,
  attendanceVerificationLogs,
  billingCustomers,
  subscriptions,
  webhookEvents,
  employeeConsents,
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
  type BillingCustomer,
  type InsertBillingCustomer,
  type Subscription,
  type InsertSubscription,
  type WebhookEvent,
  type InsertWebhookEvent,
  type EmployeeConsent,
  type InsertEmployeeConsent,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";


export interface IStorage {
  // Organization operations
  createOrganization(org: InsertOrganization): Promise<Organization>;
  getOrganization(id: number): Promise<Organization | undefined>;
  getOrganizationBySlug(slug: string): Promise<Organization | undefined>;
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
  updateUserPassword(userId: number, hashedPassword: string): Promise<User>;
  updateUserPin(userId: number, pinHash: string): Promise<User>;
  disableUserPin(userId: number): Promise<User>;
  clearUserFaceData(userId: number): Promise<User>;
  getAllEmployees(organizationId?: number): Promise<User[]>;
  getAllUsers(organizationId?: number): Promise<User[]>;
  deleteUser(id: number): Promise<void>;
  getActiveEmployeeCount(organizationId: number): Promise<number>;

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

  // Billing operations
  getBillingCustomer(organisationId: number): Promise<BillingCustomer | undefined>;
  getBillingCustomerByStripeId(stripeCustomerId: string): Promise<BillingCustomer | undefined>;
  createBillingCustomer(customer: InsertBillingCustomer): Promise<BillingCustomer>;
  getSubscription(organisationId: number): Promise<Subscription | undefined>;
  getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | undefined>;
  createSubscription(sub: InsertSubscription): Promise<Subscription>;
  updateSubscription(stripeSubscriptionId: string, updates: Partial<Subscription>): Promise<Subscription>;
  getWebhookEvent(stripeEventId: string): Promise<WebhookEvent | undefined>;
  createWebhookEvent(event: InsertWebhookEvent): Promise<WebhookEvent>;

  // Consent operations
  createConsent(consent: InsertEmployeeConsent): Promise<EmployeeConsent>;
  getUserConsents(userId: number, organisationId: number): Promise<EmployeeConsent[]>;
  revokeConsent(userId: number, consentType: string): Promise<void>;

}

export class DatabaseStorage implements IStorage {

  constructor() {
    // Session store is managed in auth.ts via connect-pg-simple
  }

  // ─── Organization ───────────────────────────
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

  async getOrganizationBySlug(slug: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug));
    return org || undefined;
  }

  async getAllOrganizations(): Promise<Organization[]> {
    const orgs = await db.select().from(organizations).orderBy(desc(organizations.createdAt));

    // Update current employee count for each organization
    const updatedOrgs = await Promise.all(
      orgs.map(async (org: Organization) => {
        const result = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(users)
          .where(and(
            eq(users.organizationId, org.id),
            eq(users.isActive, true)
          ));

        const count = Number(result[0].count);

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
    const organizationUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.organizationId, id));

    const userIds = organizationUsers.map((u: { id: number }) => u.id);

    for (const userId of userIds) {
      await db.delete(attendanceRecords).where(eq(attendanceRecords.userId, userId));
      await db.delete(attendanceRecords).where(eq(attendanceRecords.manuallyApprovedBy, userId));
      await db.delete(employeeLocations).where(eq(employeeLocations.userId, userId));
      await db.delete(employeeLocations).where(eq(employeeLocations.assignedById, userId));
      await db.delete(employeeInvitations).where(eq(employeeInvitations.invitedBy, userId));
      await db.delete(employeeConsents).where(eq(employeeConsents.userId, userId));
    }

    await db.delete(attendanceRecords).where(eq(attendanceRecords.organizationId, id));
    await db.delete(attendanceVerificationLogs).where(eq(attendanceVerificationLogs.organizationId, id));
    await db.delete(employeeLocations).where(eq(employeeLocations.organizationId, id));
    await db.delete(employeeInvitations).where(eq(employeeInvitations.organizationId, id));
    await db.delete(locations).where(eq(locations.organizationId, id));
    await db.delete(subscriptions).where(eq(subscriptions.organisationId, id));
    await db.delete(billingCustomers).where(eq(billingCustomers.organisationId, id));
    await db.delete(employeeConsents).where(eq(employeeConsents.organisationId, id));
    await db.delete(users).where(eq(users.organizationId, id));
    await db.delete(organizations).where(eq(organizations.id, id));
  }

  async updateOrganizationEmployeeCount(organizationId: number): Promise<void> {
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

  // ─── Users ──────────────────────────────────
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

  async updateUserPin(userId: number, pinHash: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        pinHash,
        pinEnabled: true,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async disableUserPin(userId: number): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        pinHash: null,
        pinEnabled: false,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async clearUserFaceData(userId: number): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        faceImageUrl: null,
        faceEmbedding: null,
        updatedAt: new Date()
      })
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

  async getActiveEmployeeCount(organizationId: number): Promise<number> {
    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users)
      .where(and(
        eq(users.organizationId, organizationId),
        eq(users.role, "employee"),
        eq(users.isActive, true)
      ));
    return Number(result[0].count);
  }

  // ─── Attendance ─────────────────────────────
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

  // ─── Locations ──────────────────────────────
  async createLocation(location: InsertLocation): Promise<Location> {
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
    await db.delete(employeeLocations)
      .where(eq(employeeLocations.locationId, id));

    await db.update(attendanceRecords)
      .set({ locationId: null })
      .where(eq(attendanceRecords.locationId, id));

    await db.delete(locations)
      .where(eq(locations.id, id));
  }

  // ─── Invitations ────────────────────────────
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

  // ─── Employee Locations ─────────────────────
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
        organizationId: users.organizationId,
        faceImageUrl: users.faceImageUrl,
        faceEmbedding: users.faceEmbedding,
        pinHash: users.pinHash,
        pinEnabled: users.pinEnabled,
        lastPinUsed: users.lastPinUsed,
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

      return result.map((row: any) => ({
        id: row.employee_locations.id,
        userId: row.employee_locations.userId,
        locationId: row.employee_locations.locationId,
        assignedById: row.employee_locations.assignedById,
        organizationId: row.employee_locations.organizationId,
        createdAt: row.employee_locations.createdAt,
        user: row.users,
        location: row.locations
      }));
    } catch (error) {
      console.error("Error getting employee location assignments:", error);
      return [];
    }
  }

  // ─── Verification Logs ──────────────────────
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

  // ─── Billing ────────────────────────────────
  async getBillingCustomer(organisationId: number): Promise<BillingCustomer | undefined> {
    const [customer] = await db
      .select()
      .from(billingCustomers)
      .where(eq(billingCustomers.organisationId, organisationId));
    return customer || undefined;
  }

  async getBillingCustomerByStripeId(stripeCustomerId: string): Promise<BillingCustomer | undefined> {
    const [customer] = await db
      .select()
      .from(billingCustomers)
      .where(eq(billingCustomers.stripeCustomerId, stripeCustomerId));
    return customer || undefined;
  }

  async createBillingCustomer(customer: InsertBillingCustomer): Promise<BillingCustomer> {
    const [billingCustomer] = await db
      .insert(billingCustomers)
      .values(customer)
      .returning();
    return billingCustomer;
  }

  async getSubscription(organisationId: number): Promise<Subscription | undefined> {
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organisationId, organisationId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);
    return sub || undefined;
  }

  async getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | undefined> {
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
    return sub || undefined;
  }

  async createSubscription(sub: InsertSubscription): Promise<Subscription> {
    const [subscription] = await db
      .insert(subscriptions)
      .values(sub)
      .returning();
    return subscription;
  }

  async updateSubscription(stripeSubscriptionId: string, updates: Partial<Subscription>): Promise<Subscription> {
    const [subscription] = await db
      .update(subscriptions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
      .returning();
    return subscription;
  }

  async getWebhookEvent(stripeEventId: string): Promise<WebhookEvent | undefined> {
    const [event] = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.stripeEventId, stripeEventId));
    return event || undefined;
  }

  async createWebhookEvent(event: InsertWebhookEvent): Promise<WebhookEvent> {
    const [webhookEvent] = await db
      .insert(webhookEvents)
      .values(event)
      .returning();
    return webhookEvent;
  }

  // ─── Consents ───────────────────────────────
  async createConsent(consent: InsertEmployeeConsent): Promise<EmployeeConsent> {
    const [newConsent] = await db
      .insert(employeeConsents)
      .values(consent)
      .returning();
    return newConsent;
  }

  async getUserConsents(userId: number, organisationId: number): Promise<EmployeeConsent[]> {
    return await db
      .select()
      .from(employeeConsents)
      .where(and(
        eq(employeeConsents.userId, userId),
        eq(employeeConsents.organisationId, organisationId)
      ))
      .orderBy(desc(employeeConsents.consentedAt));
  }

  async revokeConsent(userId: number, consentType: string): Promise<void> {
    await db
      .update(employeeConsents)
      .set({ revokedAt: new Date() })
      .where(and(
        eq(employeeConsents.userId, userId),
        eq(employeeConsents.consentType, consentType),
        sql`${employeeConsents.revokedAt} IS NULL`
      ));
  }
}

export const storage = new DatabaseStorage();