import {
  pgTable,
  text,
  varchar,
  timestamp,
  serial,
  integer,
  boolean,
  json,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Organizations table - for multi-tenant support
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  domain: varchar("domain").unique(), // Optional custom domain
  industry: varchar("industry"),
  size: varchar("size"),
  adminId: integer("admin_id"), // Will be set after admin user is created
  employeeCount: integer("employee_count").default(0),
  currentEmployees: integer("current_employees").default(0),
  maxEmployees: integer("max_employees").default(100),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User storage table - redesigned for attendance system
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email").notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  password: varchar("password").notNull(),
  role: varchar("role").notNull().default("employee"), // employee, manager, admin, developer
  organizationId: integer("organization_id").references(() => organizations.id),
  faceImageUrl: varchar("face_image_url"), // Simple face image for recognition
  faceEmbedding: json("face_embedding"), // Face embedding for recognition
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Location settings for check-in restrictions
export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  name: varchar("name").notNull(),
  postcode: varchar("postcode").notNull(),
  address: text("address"),
  latitude: varchar("latitude"),
  longitude: varchar("longitude"),
  radiusMeters: integer("radius_meters").default(100), // Check-in radius
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const attendanceRecords = pgTable("attendance_records", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  userId: integer("user_id").notNull().references(() => users.id),
  clockInTime: timestamp("clock_in_time").notNull(),
  clockOutTime: timestamp("clock_out_time"),
  date: varchar("date").notNull(),
  locationId: integer("location_id").references(() => locations.id),
  checkInMethod: varchar("check_in_method").default("face"), // face, manual
  manuallyApprovedBy: integer("manually_approved_by").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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

// Junction table for employee location assignments
export const employeeLocations = pgTable("employee_locations", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  userId: integer("user_id").notNull().references(() => users.id),
  locationId: integer("location_id").notNull().references(() => locations.id),
  assignedById: integer("assigned_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  users: many(users),
  locations: many(locations),
  attendanceRecords: many(attendanceRecords),
  employeeInvitations: many(employeeInvitations),
  employeeLocations: many(employeeLocations),
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
  approvedRecords: many(attendanceRecords, {
    relationName: "approvedBy"
  }),
  employeeLocations: many(employeeLocations),
  assignedLocations: many(employeeLocations, { relationName: "assignedBy" }),
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

// Login schemas
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  organizationId: z.number().optional(), // For developer login
});

export const registerSchema = insertUserSchema.extend({
  confirmPassword: z.string().min(6),
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
export type LoginData = z.infer<typeof loginSchema>;
export type RegisterData = z.infer<typeof registerSchema>;