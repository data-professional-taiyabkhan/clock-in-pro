import {
  pgTable,
  text,
  varchar,
  timestamp,
  serial,
  integer,
  boolean,
  json,
  real,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ──────────────────────────────────────────────
// Organizations
// ──────────────────────────────────────────────
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  slug: varchar("slug").unique(), // URL-friendly identifier for login
  domain: varchar("domain").unique(), // Optional custom domain
  industry: varchar("industry"),
  size: varchar("size"),
  adminId: integer("admin_id"), // Will be set after admin user is created
  employeeCount: integer("employee_count").default(0),
  currentEmployees: integer("current_employees").default(0),
  maxEmployees: integer("max_employees").default(100),
  isActive: boolean("is_active").default(true),
  // Trial
  trialEndsAt: timestamp("trial_ends_at"), // null = no trial set; compared to now()
  // Face/biometric settings
  faceEnabled: boolean("face_enabled").default(true),
  faceRetentionDays: integer("face_retention_days").default(365),
  // Branding for the employee login page (/org/:slug) and in-app header
  logoUrl: text("logo_url"), // data URI, max ~600KB
  brandColor: varchar("brand_color"), // #rrggbb
  wallpaperUrl: text("wallpaper_url"), // data URI, max ~2.5MB
  wallpaperPreset: varchar("wallpaper_preset"), // aurora | ocean | sunset | forest | graphite | rose
  welcomeTitle: varchar("welcome_title"),
  welcomeMessage: text("welcome_message"),
  // Scheduling / lateness
  latenessGraceMinutes: integer("lateness_grace_minutes").default(5),
  timezone: varchar("timezone").default("Europe/London"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const WALLPAPER_PRESET_IDS = ["aurora", "ocean", "sunset", "forest", "graphite", "rose"] as const;

const dataUriImage = (maxBytes: number) =>
  z
    .string()
    .regex(/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/, "Must be a PNG, JPEG, WebP or GIF image")
    .refine((v) => v.length <= Math.ceil((maxBytes * 4) / 3) + 64, `Image must be under ${Math.round(maxBytes / 1024)}KB`);

export const organizationBrandingSchema = z.object({
  logoUrl: dataUriImage(600 * 1024).nullable().optional(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colour must be a hex value like #4f46e5").nullable().optional(),
  wallpaperUrl: dataUriImage(2500 * 1024).nullable().optional(),
  wallpaperPreset: z.enum(WALLPAPER_PRESET_IDS).nullable().optional(),
  welcomeTitle: z.string().trim().max(80).nullable().optional(),
  welcomeMessage: z.string().trim().max(240).nullable().optional(),
});
export type OrganizationBranding = z.infer<typeof organizationBrandingSchema>;

export const organizationSettingsSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  latenessGraceMinutes: z.number().int().min(0).max(240).optional(),
  timezone: z
    .string()
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat("en-GB", { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Unknown timezone")
    .optional(),
});
export type OrganizationSettings = z.infer<typeof organizationSettingsSchema>;

// ──────────────────────────────────────────────
// Users
// ──────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email").notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  password: varchar("password").notNull(),
  role: varchar("role").notNull().default("employee"), // employee, manager, admin
  organizationId: integer("organization_id").references(() => organizations.id),
  faceImageUrl: varchar("face_image_url"),
  faceEmbedding: json("face_embedding"),
  // PIN backup authentication
  pinHash: varchar("pin_hash"),
  pinEnabled: boolean("pin_enabled").default(false),
  lastPinUsed: timestamp("last_pin_used"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ──────────────────────────────────────────────
// Locations
// ──────────────────────────────────────────────
export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  name: varchar("name").notNull(),
  postcode: varchar("postcode").notNull(),
  address: text("address"),
  latitude: varchar("latitude"),
  longitude: varchar("longitude"),
  radiusMeters: integer("radius_meters").default(100),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// ──────────────────────────────────────────────
// Attendance Records
// ──────────────────────────────────────────────
export const attendanceRecords = pgTable("attendance_records", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  userId: integer("user_id").notNull().references(() => users.id),
  clockInTime: timestamp("clock_in_time").notNull(),
  clockOutTime: timestamp("clock_out_time"),
  date: varchar("date").notNull(),
  locationId: integer("location_id").references(() => locations.id),
  checkInMethod: varchar("check_in_method").default("face"), // face, manual, pin
  manuallyApprovedBy: integer("manually_approved_by").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ──────────────────────────────────────────────
// Attendance Verification Logs
// ──────────────────────────────────────────────
export const attendanceVerificationLogs = pgTable("attendance_verification_logs", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  userId: integer("user_id").notNull().references(() => users.id),
  attemptTime: timestamp("attempt_time").defaultNow(),
  verificationType: varchar("verification_type").notNull(), // 'face' | 'pin'
  success: boolean("success").notNull(),
  faceConfidence: real("face_confidence"),
  livenessScore: real("liveness_score"),
  locationLatitude: real("location_latitude"),
  locationLongitude: real("location_longitude"),
  deviceInfo: text("device_info"),
  failureReason: text("failure_reason"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ──────────────────────────────────────────────
// Employee Invitations
// ──────────────────────────────────────────────
export const employeeInvitations = pgTable("employee_invitations", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  email: varchar("email").notNull(),
  token: varchar("token").unique().notNull(),
  role: varchar("role").default("employee"),
  invitedBy: integer("invited_by").references(() => users.id),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// ──────────────────────────────────────────────
// Employee Location Assignments
// ──────────────────────────────────────────────
export const employeeLocations = pgTable("employee_locations", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  userId: integer("user_id").notNull().references(() => users.id),
  locationId: integer("location_id").notNull().references(() => locations.id),
  assignedById: integer("assigned_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// ──────────────────────────────────────────────
// Billing Customers (Stripe)
// ──────────────────────────────────────────────
export const billingCustomers = pgTable("billing_customers", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organizations.id).unique(),
  stripeCustomerId: varchar("stripe_customer_id").unique().notNull(),
  billingEmail: varchar("billing_email").notNull(),
  country: varchar("country"),
  taxId: varchar("tax_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ──────────────────────────────────────────────
// Subscriptions (Stripe)
// ──────────────────────────────────────────────
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  organisationId: integer("organisation_id").notNull().references(() => organizations.id),
  stripeSubscriptionId: varchar("stripe_subscription_id").unique().notNull(),
  stripePriceId: varchar("stripe_price_id").notNull(),
  status: varchar("status").notNull(), // active, trialing, past_due, canceled, unpaid
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  trialEndsAt: timestamp("trial_ends_at"),
  activeEmployeeQuantity: integer("active_employee_quantity").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ──────────────────────────────────────────────
// Webhook Events (Stripe idempotency)
// ──────────────────────────────────────────────
export const webhookEvents = pgTable("webhook_events", {
  id: serial("id").primaryKey(),
  stripeEventId: varchar("stripe_event_id").unique().notNull(),
  eventType: varchar("event_type").notNull(),
  processedAt: timestamp("processed_at").defaultNow(),
});

// ──────────────────────────────────────────────
// Employee Consents (biometric/face)
// ──────────────────────────────────────────────
export const employeeConsents = pgTable("employee_consents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  organisationId: integer("organisation_id").notNull().references(() => organizations.id),
  consentType: varchar("consent_type").notNull(), // "face_biometric"
  consentGiven: boolean("consent_given").notNull(),
  policyVersion: varchar("policy_version").notNull(),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  consentedAt: timestamp("consented_at").defaultNow(),
  revokedAt: timestamp("revoked_at"),
});

// ──────────────────────────────────────────────
// Password Reset Tokens
// ──────────────────────────────────────────────
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  token: varchar("token").unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ──────────────────────────────────────────────
// Shift templates (weekly contracts) — one row per employee per weekday
// ──────────────────────────────────────────────
export const shiftTemplates = pgTable(
  "shift_templates",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").notNull().references(() => organizations.id),
    userId: integer("user_id").notNull().references(() => users.id),
    dayOfWeek: integer("day_of_week").notNull(), // 0 = Sunday … 6 = Saturday
    startTime: varchar("start_time").notNull(), // "HH:MM" local time
    endTime: varchar("end_time").notNull(), // "HH:MM" local time; <= start means it ends next day
    locationId: integer("location_id").references(() => locations.id),
    effectiveFrom: varchar("effective_from"), // "YYYY-MM-DD" or null
    effectiveTo: varchar("effective_to"), // "YYYY-MM-DD" or null
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [uniqueIndex("shift_templates_user_day_idx").on(t.userId, t.dayOfWeek)]
);

// ──────────────────────────────────────────────
// Shifts — one-off shifts and overrides for a specific date
// ──────────────────────────────────────────────
export const shifts = pgTable(
  "shifts",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organization_id").notNull().references(() => organizations.id),
    userId: integer("user_id").notNull().references(() => users.id),
    date: varchar("date").notNull(), // "YYYY-MM-DD" in the organisation's timezone
    startTime: varchar("start_time").notNull(),
    endTime: varchar("end_time").notNull(),
    locationId: integer("location_id").references(() => locations.id),
    status: varchar("status").notNull().default("scheduled"), // scheduled | cancelled
    notes: text("notes"),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [uniqueIndex("shifts_user_date_idx").on(t.userId, t.date)]
);

// ══════════════════════════════════════════════
// RELATIONS
// ══════════════════════════════════════════════

export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  users: many(users),
  locations: many(locations),
  attendanceRecords: many(attendanceRecords),
  attendanceVerificationLogs: many(attendanceVerificationLogs),
  employeeInvitations: many(employeeInvitations),
  employeeLocations: many(employeeLocations),
  billingCustomer: one(billingCustomers, {
    fields: [organizations.id],
    references: [billingCustomers.organisationId],
  }),
  subscriptions: many(subscriptions),
  admin: one(users, {
    fields: [organizations.adminId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many, one }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  attendanceRecords: many(attendanceRecords),
  attendanceVerificationLogs: many(attendanceVerificationLogs),
  approvedRecords: many(attendanceRecords, {
    relationName: "approvedBy"
  }),
  employeeLocations: many(employeeLocations),
  assignedLocations: many(employeeLocations, { relationName: "assignedBy" }),
  consents: many(employeeConsents),
}));

export const locationsRelations = relations(locations, ({ many, one }) => ({
  organization: one(organizations, {
    fields: [locations.organizationId],
    references: [organizations.id],
  }),
  attendanceRecords: many(attendanceRecords),
  employeeAssignments: many(employeeLocations),
}));

export const attendanceRecordsRelations = relations(attendanceRecords, ({ one }) => ({
  organization: one(organizations, {
    fields: [attendanceRecords.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [attendanceRecords.userId],
    references: [users.id],
  }),
  location: one(locations, {
    fields: [attendanceRecords.locationId],
    references: [locations.id],
  }),
  approvedBy: one(users, {
    fields: [attendanceRecords.manuallyApprovedBy],
    references: [users.id],
    relationName: "approvedBy"
  }),
}));

export const employeeInvitationsRelations = relations(employeeInvitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [employeeInvitations.organizationId],
    references: [organizations.id],
  }),
  invitedBy: one(users, {
    fields: [employeeInvitations.invitedBy],
    references: [users.id],
  }),
}));

export const employeeLocationsRelations = relations(employeeLocations, ({ one }) => ({
  organization: one(organizations, {
    fields: [employeeLocations.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [employeeLocations.userId],
    references: [users.id],
  }),
  location: one(locations, {
    fields: [employeeLocations.locationId],
    references: [locations.id],
  }),
  assignedBy: one(users, {
    fields: [employeeLocations.assignedById],
    references: [users.id],
    relationName: "assignedBy",
  }),
}));

export const attendanceVerificationLogsRelations = relations(attendanceVerificationLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [attendanceVerificationLogs.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [attendanceVerificationLogs.userId],
    references: [users.id],
  }),
}));

export const billingCustomersRelations = relations(billingCustomers, ({ one }) => ({
  organisation: one(organizations, {
    fields: [billingCustomers.organisationId],
    references: [organizations.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  organisation: one(organizations, {
    fields: [subscriptions.organisationId],
    references: [organizations.id],
  }),
}));

export const employeeConsentsRelations = relations(employeeConsents, ({ one }) => ({
  user: one(users, {
    fields: [employeeConsents.userId],
    references: [users.id],
  }),
  organisation: one(organizations, {
    fields: [employeeConsents.organisationId],
    references: [organizations.id],
  }),
}));

// ══════════════════════════════════════════════
// ZOD INSERT SCHEMAS
// ══════════════════════════════════════════════

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  employeeCount: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAttendanceRecordSchema = createInsertSchema(attendanceRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLocationSchema = createInsertSchema(locations).omit({
  id: true,
  createdAt: true,
}).extend({
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const insertInvitationSchema = createInsertSchema(employeeInvitations).omit({
  id: true,
  createdAt: true,
  token: true,
});

export const insertEmployeeLocationSchema = createInsertSchema(employeeLocations).omit({
  id: true,
  createdAt: true,
});

export const insertAttendanceVerificationLogSchema = createInsertSchema(attendanceVerificationLogs).omit({
  id: true,
  createdAt: true,
});

export const insertBillingCustomerSchema = createInsertSchema(billingCustomers).omit({
  id: true,
  createdAt: true,
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWebhookEventSchema = createInsertSchema(webhookEvents).omit({
  id: true,
  processedAt: true,
});

export const insertEmployeeConsentSchema = createInsertSchema(employeeConsents).omit({
  id: true,
  consentedAt: true,
});

// ══════════════════════════════════════════════
// VALIDATION SCHEMAS
// ══════════════════════════════════════════════

// Login schemas
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  organizationId: z.number().optional(),
  slug: z.string().optional(),
});

export const registerSchema = insertUserSchema.extend({
  confirmPassword: z.string().min(6),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Signup schema (public org + admin creation)
export const signupSchema = z.object({
  orgName: z.string().min(2, "Organisation name must be at least 2 characters"),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  plan: z.enum(["monthly", "annual"]).optional(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Password change schema
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6),
  confirmPassword: z.string().min(6),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "New passwords don't match",
  path: ["confirmPassword"],
});

// PIN setup schema
export const setupPinSchema = z.object({
  pin: z.string().min(4).max(6).regex(/^\d+$/, "PIN must contain only digits"),
  confirmPin: z.string().min(4).max(6),
}).refine(data => data.pin === data.confirmPin, {
  message: "PINs don't match",
  path: ["confirmPin"],
});

// PIN verification schema
export const verifyPinSchema = z.object({
  pin: z.string().min(4).max(6).regex(/^\d+$/, "PIN must contain only digits"),
});

// Consent schema
export const consentSchema = z.object({
  consentType: z.enum(["face_biometric"]),
  consentGiven: z.boolean(),
  policyVersion: z.string().min(1),
});

// ══════════════════════════════════════════════
// TYPE EXPORTS
// ══════════════════════════════════════════════

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type InsertAttendanceRecord = z.infer<typeof insertAttendanceRecordSchema>;
export type Location = typeof locations.$inferSelect;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type EmployeeInvitation = typeof employeeInvitations.$inferSelect;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type EmployeeLocation = typeof employeeLocations.$inferSelect;
export type InsertEmployeeLocation = z.infer<typeof insertEmployeeLocationSchema>;
export type AttendanceVerificationLog = typeof attendanceVerificationLogs.$inferSelect;
export type InsertAttendanceVerificationLog = z.infer<typeof insertAttendanceVerificationLogSchema>;
export type BillingCustomer = typeof billingCustomers.$inferSelect;
export type InsertBillingCustomer = z.infer<typeof insertBillingCustomerSchema>;
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type InsertWebhookEvent = z.infer<typeof insertWebhookEventSchema>;
export type EmployeeConsent = typeof employeeConsents.$inferSelect;
export type InsertEmployeeConsent = z.infer<typeof insertEmployeeConsentSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type RegisterData = z.infer<typeof registerSchema>;
export type SignupData = z.infer<typeof signupSchema>;
export type SetupPinData = z.infer<typeof setupPinSchema>;
export type VerifyPinData = z.infer<typeof verifyPinSchema>;
export type ConsentData = z.infer<typeof consentSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
// ══════════════════════════════════════════════
// SCHEDULING SCHEMAS
// ══════════════════════════════════════════════

export const timeHHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM");
export const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

export const contractDaySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: timeHHMM,
  endTime: timeHHMM,
  locationId: z.number().int().positive().nullable().optional(),
});

export const weeklyContractSchema = z.object({
  days: z.array(contractDaySchema).max(7),
  effectiveFrom: dateKey.nullable().optional(),
  effectiveTo: dateKey.nullable().optional(),
}).refine((c) => new Set(c.days.map((d) => d.dayOfWeek)).size === c.days.length, { message: "Each weekday can only appear once", path: ["days"] });

export const shiftUpsertSchema = z.object({
  userId: z.number().int().positive(),
  date: dateKey,
  startTime: timeHHMM,
  endTime: timeHHMM,
  locationId: z.number().int().positive().nullable().optional(),
  notes: z.string().trim().max(240).nullable().optional(),
  status: z.enum(["scheduled", "cancelled"]).optional(),
});

export type ShiftTemplate = typeof shiftTemplates.$inferSelect;
export type InsertShiftTemplate = typeof shiftTemplates.$inferInsert;
export type Shift = typeof shifts.$inferSelect;
export type InsertShift = typeof shifts.$inferInsert;
export type WeeklyContract = z.infer<typeof weeklyContractSchema>;
export type ShiftUpsert = z.infer<typeof shiftUpsertSchema>;
