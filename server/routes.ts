import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, requireAuth, requireAdmin, hashPassword, comparePasswords } from "./auth";
import { storage } from "./storage";
import { insertAttendanceRecordSchema, insertLocationSchema, loginSchema, registerSchema, insertOrganizationSchema, setupPinSchema, verifyPinSchema, signupSchema, users, employeeInvitations, locations, employeeLocations } from "@shared/schema";
import type { User } from "@shared/schema";
import { z } from "zod";
import { desc, eq, and } from "drizzle-orm";
import { db } from "./db";
import crypto from "crypto";
import { format, differenceInMinutes, differenceInSeconds, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { AuditLogger } from "./lib/audit-logger";
import { createRateLimitMiddleware, createAuthRateLimitMiddleware } from "./lib/rate-limiter";
import { DeviceFingerprinting } from "./lib/device-fingerprinting";
import { AnomalyDetection } from "./lib/anomaly-detection";
import { sendInvitationEmail } from "./lib/email";

// Face recognition & image storage (local implementations)
import { uploadFaceImage, getSignedFaceImageUrl, downloadFaceImageAsBase64 } from "./lib/face-image-storage";
import { analyzeFaceQuality } from "./lib/face-recognition";

const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;

function toSafeUser(user: User) {
  const { password: _password, faceEmbedding: _faceEmbedding, pinHash: _pinHash, ...rest } = user;
  const hasEmbedding = Array.isArray(user.faceEmbedding)
    ? user.faceEmbedding.length > 0
    : Boolean(user.faceEmbedding);

  return {
    ...rest,
    faceRegistered: hasEmbedding,
  };
}

// NOTE: Python helpers removed — face recognition uses face-api.js descriptors

// Calculate Euclidean distance between two face embedding vectors
function calculateEuclideanDistance(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embedding lengths must match');
  }

  let sum = 0;
  for (let i = 0; i < embedding1.length; i++) {
    const diff = embedding1[i] - embedding2[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

// Simple distance calculation for location verification
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Liveness detection stub — placeholder until a local model is integrated.
// For now the stub always passes. PIN clock-in is the recommended production path.
async function performLivenessDetection(_imageData: string): Promise<{
  success: boolean;
  livenessScore: number;
  isLive: boolean;
  analysis?: any;
  recommendations?: string[];
  error?: string;
}> {
  // Stub: no real anti-spoofing. Always returns pass-through.
  console.log("Liveness check: stub (no real anti-spoofing) → pass-through");
  return {
    success: true,
    livenessScore: 100,
    isLive: true,
    analysis: { provider: 'stub', note: 'No real anti-spoofing — future project' },
    recommendations: []
  };
}

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // ── Health check (Railway / uptime monitors) ──────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  // Authentication routes
  app.post("/api/login", async (req, res) => {
    try {
      // SECURITY: never log req.body here — it contains plaintext credentials.
      console.log("Login attempt:", { email: req.body?.email, hasOrg: !!req.body?.organizationId });

      const { email, password, organizationId } = req.body;
      console.log("Parsed credentials:", { email, password: password ? "***" : "missing", organizationId });

      // Get user by email and organization ID for organization-specific authentication
      const user = await storage.getUserByEmail(email, organizationId);
      console.log("User found:", user ? `${user.email} (active: ${user.isActive}, org: ${user.organizationId})` : "none");

      if (!user) {
        return res.status(401).json({ message: "Invalid email or password, or user not found in this organization" });
      }

      // Check if user belongs to the correct organization
      if (organizationId && user.organizationId !== organizationId) {
        return res.status(401).json({ message: "User does not belong to this organization" });
      }

      if (!user.isActive) {
        return res.status(401).json({ message: "Account is inactive" });
      }

      const isPasswordValid = await comparePasswords(password, user.password);


      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Set session
      (req.session as any).userId = user.id;
      console.log("Session set for user:", user.id);

      // Return user without password
      res.json(toSafeUser(user));
    } catch (error) {
      console.error("Login error:", error);
      res.status(400).json({ message: "Login failed" });
    }
  });

  app.post("/api/register", requireAdmin, async (req, res) => {
    try {
      const userData = registerSchema.parse(req.body);

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Hash password
      const hashedPassword = await hashPassword(userData.password);

      const { confirmPassword, ...userToCreate } = userData;
      const user = await storage.createUser({
        ...userToCreate,
        password: hashedPassword,
      });

      // Return user without password
      res.json(toSafeUser(user));
    } catch (error) {
      console.error("Registration error:", error);
      res.status(400).json({ message: "Registration failed" });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.session?.destroy(() => {
      res.json({ message: "Logged out successfully" });
    });
  });

  // ── Public: look up organisation by slug (for employee login page) ──
  app.get("/api/org/:slug", async (req, res) => {
    try {
      const org = await storage.getOrganizationBySlug(req.params.slug);
      if (!org) return res.status(404).json({ message: "Organisation not found" });
      res.json({ id: org.id, name: org.name, slug: org.slug });
    } catch {
      res.status(500).json({ message: "Server error" });
    }
  });

  // ── Public signup: create organisation + admin + trial ──
  app.post("/api/signup", async (req, res) => {
    try {
      const data = signupSchema.parse(req.body);

      // Check slug uniqueness
      const existingOrg = await storage.getOrganizationBySlug(data.slug);
      if (existingOrg) {
        return res.status(400).json({ message: "Organisation slug already taken" });
      }

      // Check email uniqueness (global — admin emails should be unique)
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }

      // Create organisation with 14-day trial
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);

      const org = await storage.createOrganization({
        name: data.orgName,
        slug: data.slug,
        isActive: true,
        trialEndsAt: trialEnd,
      });

      // Create admin user
      const hashedPassword = await hashPassword(data.password);
      const adminUser = await storage.createUser({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        password: hashedPassword,
        role: "admin",
        organizationId: org.id,
        isActive: true,
      });

      // Link admin to organisation
      await storage.updateOrganization(org.id, { adminId: adminUser.id });

      // Auto-login
      (req.session as any).userId = adminUser.id;

      res.json({
        user: toSafeUser(adminUser),
        organization: { id: org.id, name: org.name, slug: org.slug, trialEndsAt: org.trialEndsAt },
      });
    } catch (error) {
      console.error("Signup error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid signup data", errors: error.errors });
      }
      res.status(500).json({ message: "Signup failed" });
    }
  });

  app.get("/api/user", requireAuth, (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    res.json(toSafeUser(req.user));
  });

  // Return the current user's organisation info
  app.get("/api/organization", requireAuth, async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ message: "Not authenticated" });
      if (!req.user!.organizationId!) return res.status(404).json({ message: "No organisation" });
      const org = await storage.getOrganization(req.user!.organizationId!);
      if (!org) return res.status(404).json({ message: "Organisation not found" });
      res.json({ id: org.id, name: org.name, slug: org.slug });
    } catch {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/register-face", requireAuth, async (req, res) => {
    try {
      const { faceData } = req.body as { faceData?: string };

      if (!faceData || typeof faceData !== "string" || faceData.trim().length === 0) {
        return res.status(400).json({ message: "Face data is required" });
      }

      // Defense in depth: require face_biometric consent before registration
      const orgId = req.user!.organizationId;
      if (orgId) {
        const consents = await storage.getUserConsents(req.user!.id, orgId);
        const hasFaceConsent = consents.some(
          (c: any) => c.consentType === 'face_biometric' && c.consentGiven && !c.revokedAt
        );
        if (!hasFaceConsent) {
          return res.status(403).json({
            message: "Biometric consent required before face registration"
          });
        }
      }

      let updatedUser: User | undefined;

      if (faceData.startsWith("data:image/")) {
        // Raw image uploads are no longer supported — the Python/InsightFace
        // pipeline has been removed. Clients must send face-api.js descriptors.
        return res.status(400).json({
          message: "Face registration requires a descriptor payload. Please update the app / refresh the page."
        });

      } else {
        // Handle embedding or advanced training data directly
        let embedding: number[] | null = null;
        let trainingPayload: any | null = null;

        try {
          const parsed = JSON.parse(faceData);

          // Advanced training payload: { version, type: 'advanced-training', primaryDescriptor, poseDescriptors[] }
          if (parsed && typeof parsed === 'object' && parsed.type === 'advanced-training' && Array.isArray(parsed.primaryDescriptor)) {
            trainingPayload = parsed;

            // Build centroid from primary + pose descriptors when available
            const descriptors: number[][] = [];
            if (Array.isArray(parsed.primaryDescriptor)) descriptors.push(parsed.primaryDescriptor);
            if (Array.isArray(parsed.poseDescriptors)) {
              for (const pd of parsed.poseDescriptors) {
                if (pd && Array.isArray(pd.descriptor)) descriptors.push(pd.descriptor);
              }
            }

            if (descriptors.length > 0) {
              const length = descriptors[0].length;
              const centroid = new Array(length).fill(0);
              for (const desc of descriptors) {
                if (Array.isArray(desc) && desc.length === length) {
                  for (let i = 0; i < length; i++) centroid[i] += desc[i];
                }
              }
              for (let i = 0; i < length; i++) centroid[i] /= descriptors.length;
              embedding = centroid;
            }
          } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).descriptor)) {
            // Payload from camera-face-capture: { descriptor: number[], imageData: string }
            const desc = (parsed as any).descriptor as unknown[];
            const normalized = desc
              .map((value) => (typeof value === "number" ? value : Number.parseFloat(String(value))))
              .filter((value) => Number.isFinite(value));
            if (normalized.length === desc.length && normalized.length > 0) embedding = normalized as number[];
          } else if (Array.isArray(parsed)) {
            const normalized = parsed
              .map((value) => (typeof value === "number" ? value : Number.parseFloat(value)))
              .filter((value) => Number.isFinite(value));
            if (normalized.length === parsed.length && normalized.length > 0) embedding = normalized;
          } else if (parsed && typeof parsed === "object") {
            // Generic object of numbers -> flatten
            const numbers: number[] = [];
            const collectNumbers = (value: unknown) => {
              if (typeof value === "number" && Number.isFinite(value)) { numbers.push(value); return; }
              if (Array.isArray(value)) { value.forEach(collectNumbers); return; }
              if (value && typeof value === "object") { Object.values(value as Record<string, unknown>).forEach(collectNumbers); }
            };
            collectNumbers(parsed);
            if (numbers.length > 0) embedding = numbers;
          }
        } catch (error) {
          console.warn("Failed to parse face embedding/training data", error);
        }

        if (!embedding) {
          return res.status(400).json({ message: "Invalid face data provided" });
        }

        // Save embedding (centroid) and optionally persist full training payload for future upgrades
        updatedUser = await storage.updateUserFaceEmbedding(
          req.user!.id,
          req.user?.faceImageUrl ?? undefined,
          embedding
        );



      }

      if (!updatedUser) {
        throw new Error("Failed to update face data");
      }

      req.user = updatedUser;

      res.json({
        message: "Face registered successfully",
        user: toSafeUser(updatedUser),
        hasEmbedding: !!updatedUser.faceEmbedding
      });
    } catch (error) {
      console.error("Face registration error:", error);
      res.status(500).json({ message: "Failed to register face" });
    }
  });

  // Password change route for all authenticated users
  app.post("/api/user/change-password", requireAuth, async (req, res) => {
    try {
      // Create a simplified schema that only requires currentPassword and newPassword
      const passwordChangeSchema = z.object({
        currentPassword: z.string().min(6),
        newPassword: z.string().min(6),
      });

      const { currentPassword, newPassword } = passwordChangeSchema.parse(req.body);

      // Get fresh user data to ensure we have the latest password hash
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isPasswordValid = await comparePasswords(currentPassword, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      // Hash new password
      const hashedNewPassword = await hashPassword(newPassword);

      // Update password
      await storage.updateUserPassword(user.id, hashedNewPassword);

      console.log(`Password changed successfully for user ${user.email}`);
      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Password change error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data" });
      }
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Manager/Admin employee reference photo upload
  app.post("/api/employees/:id/face-image", requireAuth, async (req, res) => {
    try {
      // Check if user is manager or admin
      if (req.user!.role !== 'manager' && req.user!.role !== 'admin') {
        return res.status(403).json({ message: "Manager or Admin access required" });
      }

      const { imageData } = req.body;
      const employeeId = parseInt(req.params.id);

      if (!imageData || !imageData.startsWith('data:image/')) {
        return res.status(400).json({ message: "Invalid image data" });
      }

      // CRITICAL: Verify that the employee belongs to the same organization as the manager
      const employee = await storage.getUser(employeeId);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }

      if (employee.organizationId !== req.user!.organizationId!) {
        return res.status(403).json({ message: "Access denied - employee not in your organization" });
      }

      // Basic image validation
      const base64 = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      if (base64.length < 1000) {
        return res.status(400).json({
          message: "Image appears to be too small or invalid"
        });
      }

      // Analyze face quality
      const qualityCheck = await analyzeFaceQuality(imageData);

      if (!qualityCheck.isGoodQuality) {
        return res.status(400).json({
          message: "Poor image quality",
          issues: qualityCheck.issues,
          recommendations: [
            "Ensure good lighting",
            "Make sure face is clearly visible",
            "Avoid blurry images",
            "Remove sunglasses"
          ]
        });
      }

      // Store face image (reference photo only — not an embedding)
      const s3Result = await uploadFaceImage(employeeId, imageData);

      if (!s3Result.success) {
        throw new Error(s3Result.error || 'Image storage failed');
      }

      // Update database with reference photo
      await storage.updateUserFaceImage(employeeId, s3Result.imageUrl!);

      // Get updated user
      const updatedUser = await storage.getUser(employeeId);
      if (!updatedUser) {
        throw new Error('Failed to retrieve updated user');
      }

      const safeUser = toSafeUser(updatedUser);
      res.json({
        message: "Reference photo saved. Note: this does NOT register the employee for face clock-in — the employee must register their face from their own device (Welcome page → face registration).",
        user: safeUser,
      });

    } catch (error) {
      console.error("Reference photo upload error:", error);
      res.status(500).json({ message: "Failed to upload reference photo" });
    }
  });

  // Location management routes
  app.get("/api/locations", requireAuth, async (req, res) => {
    try {
      const locations = await storage.getActiveLocations(req.user!.organizationId!);
      res.json(locations);
    } catch (error) {
      console.error("Get locations error:", error);
      res.status(500).json({ message: "Failed to get locations" });
    }
  });

  app.post("/api/locations", requireAdmin, async (req, res) => {
    try {
      // Add organizationId from the authenticated user
      const locationData = {
        ...req.body,
        organizationId: req.user!.organizationId!
      };

      const validatedData = insertLocationSchema.parse(locationData);
      const location = await storage.createLocation(validatedData);
      res.json(location);
    } catch (error) {
      console.error("Create location error:", error);
      res.status(500).json({ message: "Failed to create location" });
    }
  });

  app.put("/api/locations/:id", requireAdmin, async (req, res) => {
    try {
      const locationId = parseInt(req.params.id);

      // Verify the location belongs to the admin's organization
      const existingLocation = await db.select().from(locations).where(eq(locations.id, locationId)).limit(1);
      if (existingLocation.length === 0) {
        return res.status(404).json({ message: "Location not found" });
      }

      if (existingLocation[0].organizationId !== req.user!.organizationId!) {
        return res.status(403).json({ message: "Access denied - location not in your organization" });
      }

      const updates = req.body;
      const location = await storage.updateLocation(locationId, updates);
      res.json(location);
    } catch (error) {
      console.error("Update location error:", error);
      res.status(500).json({ message: "Failed to update location" });
    }
  });

  app.delete("/api/locations/:id", requireAdmin, async (req, res) => {
    try {
      const locationId = parseInt(req.params.id);

      // Check if location exists and belongs to the admin's organization
      const location = await db.select().from(locations).where(eq(locations.id, locationId)).limit(1);
      if (location.length === 0) {
        return res.status(404).json({ message: "Location not found" });
      }

      if (location[0].organizationId !== req.user!.organizationId!) {
        return res.status(403).json({ message: "Access denied - location not in your organization" });
      }

      await storage.deleteLocation(locationId);
      res.json({ message: "Location deleted successfully" });
    } catch (error) {
      console.error("Delete location error:", error);
      if ((error as any).code === '23503') {
        res.status(400).json({
          message: "Cannot delete location: it has associated data. Please contact system administrator."
        });
      } else {
        res.status(500).json({ message: "Failed to delete location" });
      }
    }
  });

  // Employee location assignments (Manager only)
  app.get("/api/employee-locations", requireAdmin, async (req, res) => {
    try {
      const assignments = await storage.getAllEmployeeLocationAssignments(req.user!.organizationId!);
      res.json(assignments);
    } catch (error) {
      console.error("Get employee locations error:", error);
      res.status(500).json({ message: "Failed to get employee location assignments" });
    }
  });

  app.post("/api/employee-locations", requireAdmin, async (req, res) => {
    try {
      // SECURITY: do not log req.body — may contain sensitive assignment data.

      // Ensure we have valid data
      let userId, locationId;

      if (typeof req.body === 'string') {
        const parsed = JSON.parse(req.body);
        userId = parsed.userId;
        locationId = parsed.locationId;
      } else {
        userId = req.body.userId;
        locationId = req.body.locationId;
      }

      console.log("Parsed userId:", userId, "locationId:", locationId);

      if (!userId || !locationId) {
        return res.status(400).json({ message: "User ID and Location ID are required" });
      }

      const assignment = await storage.assignEmployeeToLocation({
        userId: parseInt(userId.toString()),
        locationId: parseInt(locationId.toString()),
        assignedById: req.user!.id,
        organizationId: req.user!.organizationId!
      });

      console.log("Assignment created:", assignment);
      res.json(assignment);
    } catch (error) {
      console.error("Assign employee location error:", error);
      res.status(500).json({ message: "Failed to assign employee to location", error: (error as Error).message });
    }
  });

  app.delete("/api/employee-locations/:userId/:locationId", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const locationId = parseInt(req.params.locationId);

      await storage.removeEmployeeFromLocation(userId, locationId);
      res.json({ message: "Employee removed from location" });
    } catch (error) {
      console.error("Remove employee location error:", error);
      res.status(500).json({ message: "Failed to remove employee from location" });
    }
  });

  app.get("/api/my-locations", requireAuth, async (req, res) => {
    try {
      const locations = await storage.getEmployeeLocations(req.user!.id);
      res.json(locations);
    } catch (error) {
      console.error("Get my locations error:", error);
      res.status(500).json({ message: "Failed to get assigned locations" });
    }
  });



  // Enhanced face verification with liveness detection and audit logging
  app.post("/api/verify-face",
    requireAuth,
    createAuthRateLimitMiddleware('faceVerification'),
    async (req, res) => {
      try {
        const { imageData, descriptor, location, userLocation, action, deviceInfo: clientDeviceInfo } = req.body;
        const finalLocation = location || userLocation;
        const deviceInfo = AuditLogger.extractDeviceInfo(req);
        const fingerprint = DeviceFingerprinting.generateFingerprint(req, clientDeviceInfo);

        // Check for suspicious activity
        const suspiciousActivities = await DeviceFingerprinting.detectSuspiciousActivity(
          req.user!.id,
          DeviceFingerprinting.extractDeviceInfo(req, clientDeviceInfo),
          finalLocation ? { latitude: parseFloat(finalLocation.latitude), longitude: parseFloat(finalLocation.longitude) } : undefined
        );

        // Log suspicious activities
        for (const activity of suspiciousActivities) {
          console.warn(`[SECURITY] Suspicious activity detected for user ${req.user!.id}:`, activity);
        }

        // Register device if new
        const isKnownDevice = await DeviceFingerprinting.isKnownDevice(req.user!.id, fingerprint);
        if (!isKnownDevice) {
          await DeviceFingerprinting.registerDevice(
            req.user!.id,
            DeviceFingerprinting.extractDeviceInfo(req, clientDeviceInfo),
            false // Not trusted initially
          );
        } else {
          await DeviceFingerprinting.updateDeviceActivity(req.user!.id, fingerprint);
        }

        console.log("Enhanced face verification request:", {
          user: req.user?.email,
          hasImageData: !!imageData,
          hasDescriptor: Array.isArray(descriptor),
          hasLocation: !!finalLocation,
          locationData: finalLocation,
          action
        });

        // Require a real face embedding (not just a reference photo)
        const userEmbedding = req.user?.faceEmbedding;
        const hasEmbedding = Array.isArray(userEmbedding) ? userEmbedding.length > 0 : Boolean(userEmbedding);
        if (!hasEmbedding) {
          await AuditLogger.logFaceVerification(
            req.user!.id,
            req.user!.organizationId!,
            false,
            {
              deviceInfo,
              failureReason: "No face embedding registered",
              metadata: { action }
            }
          );

          return res.status(400).json({
            message: "Face verification isn't set up yet. Go to Settings → Clock-In Settings → Set up face verification.",
            canUsePin: req.user!.pinEnabled
          });
        }

        // Step 1: Location verification - check if user is assigned to any locations
        const assignedLocations = await storage.getEmployeeLocations(req.user!.id);
        console.log("User assigned locations:", assignedLocations);

        // Block clock-in if employee has no assigned locations (clock-out is allowed)
        if (assignedLocations.length === 0 && action !== 'out') {
          await AuditLogger.logFaceVerification(
            req.user!.id,
            req.user!.organizationId!,
            false,
            {
              deviceInfo,
              failureReason: "No assigned work locations",
              metadata: { action }
            }
          );

          return res.status(403).json({
            message: "You're not assigned to a work location yet. Ask your admin to assign you to a location before clocking in.",
            canUsePin: false
          });
        }

        if (assignedLocations.length > 0) {
          if (!finalLocation || (!finalLocation.latitude || !finalLocation.longitude)) {
            await AuditLogger.logFaceVerification(
              req.user!.id,
              req.user!.organizationId!,
              false,
              {
                deviceInfo,
                failureReason: "Location verification required",
                metadata: { action }
              }
            );

            return res.status(400).json({
              message: "Location verification required. Please enable location services and try again.",
              canUsePin: req.user.pinEnabled
            });
          }

          // Find the closest assigned location
          let closestLocation = null;
          let minDistance = Infinity;

          for (const assignedLocation of assignedLocations) {
            if (assignedLocation.latitude && assignedLocation.longitude) {
              const distance = calculateDistance(
                parseFloat(finalLocation.latitude),
                parseFloat(finalLocation.longitude),
                parseFloat(assignedLocation.latitude),
                parseFloat(assignedLocation.longitude)
              );

              console.log(`Distance to ${assignedLocation.name}: ${distance}m (allowed: ${assignedLocation.radiusMeters}m)`);

              if (distance <= (assignedLocation.radiusMeters || 100) && distance < minDistance) {
                minDistance = distance;
                closestLocation = assignedLocation;
              }
            }
          }

          if (!closestLocation) {
            const locationNames = assignedLocations.map(loc => loc.name).join(', ');

            await AuditLogger.logFaceVerification(
              req.user!.id,
              req.user!.organizationId!,
              false,
              {
                locationLatitude: parseFloat(finalLocation.latitude),
                locationLongitude: parseFloat(finalLocation.longitude),
                deviceInfo,
                failureReason: `Not within range of assigned locations: ${locationNames}`,
                metadata: { action, minDistance }
              }
            );

            return res.status(403).json({
              message: `You are not within range of any assigned work location (${locationNames}). Please move closer to your assigned work location.`,
              canUsePin: req.user.pinEnabled
            });
          }

          console.log(`Location verification passed for ${closestLocation.name} (${minDistance}m away)`);
        }

        // Step 2: Liveness Detection
        console.log(`Starting liveness detection for ${req.user!.email}`);

        const livenessResult = await performLivenessDetection(imageData);

        if (!livenessResult.success) {
          await AuditLogger.logFaceVerification(
            req.user!.id,
            req.user!.organizationId!,
            false,
            {
              locationLatitude: finalLocation ? parseFloat(finalLocation.latitude) : undefined,
              locationLongitude: finalLocation ? parseFloat(finalLocation.longitude) : undefined,
              deviceInfo,
              failureReason: `Liveness detection failed: ${livenessResult.error}`,
              metadata: { action, livenessScore: livenessResult.livenessScore }
            }
          );

          return res.status(400).json({
            verified: false,
            message: `Liveness detection failed: ${livenessResult.error}`,
            canUsePin: req.user.pinEnabled
          });
        }

        if (!livenessResult.isLive) {
          await AuditLogger.logFaceVerification(
            req.user!.id,
            req.user!.organizationId!,
            false,
            {
              locationLatitude: finalLocation ? parseFloat(finalLocation.latitude) : undefined,
              locationLongitude: finalLocation ? parseFloat(finalLocation.longitude) : undefined,
              livenessScore: livenessResult.livenessScore,
              deviceInfo,
              failureReason: `Liveness detection failed - possible spoofing attempt`,
              metadata: {
                action,
                livenessScore: livenessResult.livenessScore,
                analysis: livenessResult.analysis,
                recommendations: livenessResult.recommendations
              }
            }
          );

          return res.status(400).json({
            verified: false,
            message: `Liveness verification failed. ${livenessResult.recommendations?.[0] || 'Please ensure you are using a live camera feed.'}`,
            canUsePin: req.user.pinEnabled,
            livenessScore: livenessResult.livenessScore,
            recommendations: livenessResult.recommendations
          });
        }

        console.log(`Liveness detection passed with score: ${livenessResult.livenessScore}`);

        // Step 3: Face Recognition — descriptor match is the ONLY path
        console.log(`Starting descriptor-based face match for ${req.user!.email}`);

        // Require a descriptor from the client
        if (!Array.isArray(descriptor)) {
          await AuditLogger.logFaceVerification(
            req.user!.id,
            req.user!.organizationId!,
            false,
            {
              deviceInfo,
              failureReason: "No descriptor provided by client",
              metadata: { action }
            }
          );

          return res.status(400).json({
            verified: false,
            message: "Face verification needs an on-device face scan. Please refresh the page and try again.",
            canUsePin: req.user.pinEnabled
          });
        }

        // Normalize embeddings then compute Euclidean distance
        const normalize = (v: number[]) => {
          const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
          return v.map(x => x / norm);
        };
        const reg = normalize(req.user.faceEmbedding as number[]);
        const probe = normalize(descriptor as number[]);
        const dist = calculateEuclideanDistance(reg, probe);
        const threshold = 0.6;
        const isMatch = dist <= threshold;

        console.log(`Descriptor match: distance=${dist.toFixed(4)} threshold=${threshold} → ${isMatch ? 'PASS' : 'FAIL'}`);

        const faceConfidence = Math.max(0, 100 - (dist * 100));

        if (isMatch) {
          // SUCCESS — create attendance record
          await AuditLogger.logFaceVerification(
            req.user!.id,
            req.user!.organizationId!,
            true,
            {
              faceConfidence,
              livenessScore: livenessResult.livenessScore,
              locationLatitude: finalLocation ? parseFloat(finalLocation.latitude) : undefined,
              locationLongitude: finalLocation ? parseFloat(finalLocation.longitude) : undefined,
              deviceInfo,
              metadata: { action, distance: dist, threshold, engine: 'face-api.js' }
            }
          );

          let attendanceRecord;
          if (action === 'out') {
            const today = new Date().toISOString().split('T')[0];
            const todayRecord = await storage.getTodayAttendanceRecord(req.user!.id, today);
            if (!todayRecord || todayRecord.clockOutTime) {
              return res.status(400).json({
                verified: false,
                message: "No active clock-in found for today or already clocked out.",
                canUsePin: req.user.pinEnabled
              });
            }
            attendanceRecord = await storage.updateAttendanceRecord(todayRecord.id, { clockOutTime: new Date() });
          } else {
            attendanceRecord = await storage.createAttendanceRecord({
              userId: req.user!.id,
              organizationId: req.user!.organizationId!,
              clockInTime: new Date(),
              date: new Date().toISOString().split('T')[0],
            });
          }

          return res.json({
            verified: true,
            distance: dist,
            threshold,
            faceConfidence,
            livenessScore: livenessResult.livenessScore,
            action: action || 'in',
            message: `Face verified successfully! You have been clocked ${action === 'out' ? 'out' : 'in'}.`,
            attendance: attendanceRecord
          });
        } else {
          // FAIL — face didn't match
          await AuditLogger.logFaceVerification(
            req.user!.id,
            req.user!.organizationId!,
            false,
            {
              faceConfidence,
              livenessScore: livenessResult.livenessScore,
              locationLatitude: finalLocation ? parseFloat(finalLocation.latitude) : undefined,
              locationLongitude: finalLocation ? parseFloat(finalLocation.longitude) : undefined,
              deviceInfo,
              failureReason: `Descriptor distance ${dist.toFixed(4)} exceeds threshold ${threshold}`,
              metadata: { action, distance: dist, threshold, engine: 'face-api.js' }
            }
          );

          console.log(`✗ Face verification REJECTED for ${req.user!.email} (distance=${dist.toFixed(4)})`);
          return res.status(400).json({
            verified: false,
            message: "Face didn't match. Try better lighting, or use your PIN.",
            canUsePin: req.user.pinEnabled,
            technical_details: {
              distance: dist.toFixed(4),
              threshold,
              livenessScore: livenessResult.livenessScore
            }
          });
        }
      } catch (error) {
        console.error("Face verification error:", error);
        return res.status(500).json({
          message: "Face verification failed",
          canUsePin: req.user?.pinEnabled || false
        });
      }
    });

  // PIN Authentication endpoints
  app.post("/api/setup-pin",
    requireAuth,
    createRateLimitMiddleware('pinSetup'),
    async (req, res) => {
      try {
        const validation = setupPinSchema.safeParse(req.body);

        if (!validation.success) {
          return res.status(400).json({
            message: "Invalid PIN format",
            errors: validation.error.errors
          });
        }

        const { pin } = validation.data;
        const hashedPin = await hashPassword(pin);

        await storage.updateUserPin(req.user!.id, hashedPin);

        res.json({
          message: "PIN set up successfully",
          pinEnabled: true
        });
      } catch (error) {
        console.error("PIN setup error:", error);
        res.status(500).json({ message: "Failed to set up PIN" });
      }
    });

  app.post("/api/verify-pin",
    requireAuth,
    createAuthRateLimitMiddleware('pinVerification'),
    async (req, res) => {
      try {
        const { pin, location, userLocation, action } = req.body;
        const finalLocation = location || userLocation;
        const deviceInfo = AuditLogger.extractDeviceInfo(req);

        // Geofence: block clock-in if employee has no assigned locations
        const assignedLocations = await storage.getEmployeeLocations(req.user!.id);
        if (assignedLocations.length === 0 && action !== 'out') {
          await AuditLogger.logPinVerification(
            req.user!.id,
            req.user!.organizationId!,
            false,
            {
              deviceInfo,
              failureReason: "No assigned work locations",
              metadata: { action }
            }
          );

          return res.status(403).json({
            message: "You're not assigned to a work location yet. Ask your admin to assign you to a location before clocking in.",
            verified: false
          });
        }

        const validation = verifyPinSchema.safeParse({ pin });

        if (!validation.success) {
          await AuditLogger.logPinVerification(
            req.user!.id,
            req.user!.organizationId!,
            false,
            {
              deviceInfo,
              failureReason: "Invalid PIN format",
              metadata: { action }
            }
          );

          return res.status(400).json({
            message: "Invalid PIN format",
            errors: validation.error.errors
          });
        }

        if (!req.user!.pinEnabled || !req.user!.pinHash) {
          await AuditLogger.logPinVerification(
            req.user!.id,
            req.user!.organizationId!,
            false,
            {
              deviceInfo,
              failureReason: "PIN not enabled for user",
              metadata: { action }
            }
          );

          return res.status(400).json({
            message: "PIN authentication not enabled for your account"
          });
        }

        const isValidPin = await comparePasswords(pin, req.user!.pinHash);

        if (!isValidPin) {
          await AuditLogger.logPinVerification(
            req.user!.id,
            req.user!.organizationId!,
            false,
            {
              deviceInfo,
              failureReason: "Invalid PIN provided",
              metadata: { action }
            }
          );

          return res.status(400).json({
            message: "Invalid PIN. Please try again.",
            verified: false
          });
        }

        // Log successful PIN verification
        await AuditLogger.logPinVerification(
          req.user!.id,
          req.user!.organizationId!,
          true,
          {
            locationLatitude: finalLocation ? parseFloat(finalLocation.latitude) : undefined,
            locationLongitude: finalLocation ? parseFloat(finalLocation.longitude) : undefined,
            deviceInfo,
            metadata: { action }
          }
        );

        // Update last PIN used timestamp
        await db.update(users)
          .set({ lastPinUsed: new Date() })
          .where(eq(users.id, req.user!.id));

        // Create attendance record based on action
        let attendanceRecord;
        if (action === 'out') {
          const today = new Date().toISOString().split('T')[0];
          const todayRecord = await storage.getTodayAttendanceRecord(req.user!.id, today);

          if (!todayRecord || todayRecord.clockOutTime) {
            return res.status(400).json({
              verified: false,
              message: "No active clock-in found for today or already clocked out."
            });
          }

          attendanceRecord = await storage.updateAttendanceRecord(todayRecord.id, {
            clockOutTime: new Date(),
          });
        } else {
          attendanceRecord = await storage.createAttendanceRecord({
            userId: req.user!.id,
            organizationId: req.user!.organizationId!,
            clockInTime: new Date(),
            date: new Date().toISOString().split('T')[0],
            checkInMethod: 'pin'
          });
        }

        res.json({
          verified: true,
          action: action || 'in',
          message: `PIN verified successfully! You have been clocked ${action === 'out' ? 'out' : 'in'}.`,
          attendance: attendanceRecord,
          method: 'pin'
        });
      } catch (error) {
        console.error("PIN verification error:", error);
        res.status(500).json({ message: "PIN verification failed" });
      }
    });

  // Audit logging endpoints for managers/admins
  app.get("/api/audit-logs", requireAuth, async (req, res) => {
    try {
      if (!['manager', 'admin'].includes(req.user!.role)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { userId, limit = 50, offset = 0, verificationType, success, startDate, endDate } = req.query;

      const logs = await AuditLogger.getOrganizationAuditLogs(
        req.user!.organizationId!,
        parseInt(limit as string),
        parseInt(offset as string),
        {
          userId: userId ? parseInt(userId as string) : undefined,
          verificationType: verificationType as 'face' | 'pin' | undefined,
          success: success ? success === 'true' : undefined,
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined
        }
      );

      res.json({ logs });
    } catch (error) {
      console.error("Get audit logs error:", error);
      res.status(500).json({ message: "Failed to retrieve audit logs" });
    }
  });

  app.get("/api/audit-logs/:userId", requireAuth, async (req, res) => {
    try {
      if (!['manager', 'admin'].includes(req.user!.role)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { userId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const logs = await AuditLogger.getUserAuditLogs(
        parseInt(userId),
        req.user!.organizationId!,
        parseInt(limit as string),
        parseInt(offset as string)
      );

      res.json({ logs });
    } catch (error) {
      console.error("Get user audit logs error:", error);
      res.status(500).json({ message: "Failed to retrieve user audit logs" });
    }
  });

  app.get("/api/security-alerts", requireAuth, async (req, res) => {
    try {
      if (!['manager', 'admin'].includes(req.user!.role)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const alerts = await AuditLogger.generateSecurityAlerts(req.user!.organizationId!);

      res.json({ alerts });
    } catch (error) {
      console.error("Get security alerts error:", error);
      res.status(500).json({ message: "Failed to retrieve security alerts" });
    }
  });

  // Anomaly detection endpoints
  app.get("/api/anomalies", requireAuth, async (req, res) => {
    try {
      if (!['manager', 'admin'].includes(req.user!.role)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { hours = '24' } = req.query;
      const anomalies = await AnomalyDetection.runAnomalyDetection(req.user!.organizationId!);

      res.json({ anomalies });
    } catch (error) {
      console.error("Get anomalies error:", error);
      res.status(500).json({ message: "Failed to retrieve anomalies" });
    }
  });

  app.get("/api/security-metrics", requireAuth, async (req, res) => {
    try {
      if (!['manager', 'admin'].includes(req.user!.role)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const metrics = await AnomalyDetection.generateSecurityMetrics(req.user!.organizationId!);

      res.json({ metrics });
    } catch (error) {
      console.error("Get security metrics error:", error);
      res.status(500).json({ message: "Failed to retrieve security metrics" });
    }
  });

  // Device management endpoints
  app.get("/api/devices", requireAuth, async (req, res) => {
    try {
      const devices = await DeviceFingerprinting.getUserDevices(req.user!.id);

      res.json({ devices });
    } catch (error) {
      console.error("Get user devices error:", error);
      res.status(500).json({ message: "Failed to retrieve devices" });
    }
  });

  app.post("/api/devices/:fingerprint/trust", requireAuth, async (req, res) => {
    try {
      const { fingerprint } = req.params;

      const success = await DeviceFingerprinting.trustDevice(req.user!.id, fingerprint);

      if (success) {
        res.json({ message: "Device trusted successfully" });
      } else {
        res.status(404).json({ message: "Device not found" });
      }
    } catch (error) {
      console.error("Trust device error:", error);
      res.status(500).json({ message: "Failed to trust device" });
    }
  });

  app.delete("/api/devices/:fingerprint", requireAuth, async (req, res) => {
    try {
      const { fingerprint } = req.params;

      const success = await DeviceFingerprinting.removeDevice(req.user!.id, fingerprint);

      if (success) {
        res.json({ message: "Device removed successfully" });
      } else {
        res.status(404).json({ message: "Device not found" });
      }
    } catch (error) {
      console.error("Remove device error:", error);
      res.status(500).json({ message: "Failed to remove device" });
    }
  });

  app.get("/api/device-security-summary", requireAuth, async (req, res) => {
    try {
      const summary = await DeviceFingerprinting.getDeviceSecuritySummary(req.user!.id);

      res.json({ summary });
    } catch (error) {
      console.error("Get device security summary error:", error);
      res.status(500).json({ message: "Failed to retrieve device security summary" });
    }
  });

  // Attendance management
  app.post("/api/clock-in", requireAuth, async (req, res) => {
    try {
      const { locationPostcode, verified, method = "face" } = req.body;

      if (!verified) {
        return res.status(400).json({ message: "Face verification required for check-in" });
      }

      const today = format(new Date(), "yyyy-MM-dd");

      // Check if user has any active (unclosed) sessions today
      const records = await storage.getUserAttendanceRecords(req.user!.id, 20);
      const todayRecords = records.filter(record => record.date === today);
      const activeRecord = todayRecords.find(record => !record.clockOutTime);

      if (activeRecord) {
        return res.status(400).json({ message: "Please clock out before clocking in again" });
      }

      // Get location if postcode provided
      let locationId = null;
      if (locationPostcode) {
        const location = await storage.getLocationByPostcode(locationPostcode);
        locationId = location?.id || null;
      }

      const attendanceRecord = await storage.createAttendanceRecord({
        userId: req.user!.id,
        organizationId: req.user!.organizationId!,
        clockInTime: new Date(),
        date: today,
        locationId,
        checkInMethod: method,
      });

      res.json(attendanceRecord);
    } catch (error) {
      console.error("Clock in error:", error);
      res.status(500).json({ message: "Failed to clock in" });
    }
  });

  app.post("/api/clock-out", requireAuth, async (req, res) => {
    try {
      const today = format(new Date(), "yyyy-MM-dd");

      // Get all attendance records and find the most recent one without clock-out
      const records = await storage.getUserAttendanceRecords(req.user!.id, 20);
      const todayRecords = records.filter(record => record.date === today);

      // Find the most recent record that doesn't have a clock-out time
      const activeRecord = todayRecords
        .sort((a, b) => new Date(b.clockInTime).getTime() - new Date(a.clockInTime).getTime())
        .find(record => !record.clockOutTime);

      if (!activeRecord) {
        return res.status(400).json({ message: "You are not currently clocked in" });
      }

      // Double check that this record hasn't already been clocked out
      if (activeRecord.clockOutTime) {
        return res.status(400).json({ message: "This session is already clocked out" });
      }

      const clockOutTime = new Date();
      const totalMinutes = differenceInMinutes(clockOutTime, new Date(activeRecord.clockInTime));
      const totalHours = (totalMinutes / 60).toFixed(2);

      const updatedRecord = await storage.updateAttendanceRecord(activeRecord.id, {
        clockOutTime,
      });

      console.log(`User ${req.user!.email} clocked out from session ${activeRecord.id}`);
      res.json(updatedRecord);
    } catch (error) {
      console.error("Clock out error:", error);
      res.status(500).json({ message: "Failed to clock out" });
    }
  });

  // Manual check-in for managers
  app.post("/api/manual-clock-in", requireAdmin, async (req, res) => {
    try {
      const { userId, date, clockInTime, locationId, notes } = req.body;

      const attendanceRecord = await storage.createAttendanceRecord({
        userId,
        organizationId: req.user!.organizationId!,
        clockInTime: new Date(clockInTime),
        date,
        locationId,
        checkInMethod: "manual",
        manuallyApprovedBy: req.user!.id,
        notes
      });

      res.json(attendanceRecord);
    } catch (error) {
      console.error("Manual clock in error:", error);
      res.status(500).json({ message: "Failed to manually clock in user" });
    }
  });

  // Manual clock-out for managers
  app.post("/api/manual-clock-out", requireAdmin, async (req, res) => {
    try {
      const { userId, clockOutTime, notes } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      const today = format(new Date(), "yyyy-MM-dd");

      // Find the most recent active record for the user
      const records = await storage.getUserAttendanceRecords(userId, 20);
      const todayRecords = records.filter(record => record.date === today);

      // Find the most recent record that doesn't have a clock-out time
      const activeRecord = todayRecords
        .sort((a, b) => new Date(b.clockInTime).getTime() - new Date(a.clockInTime).getTime())
        .find(record => !record.clockOutTime);

      if (!activeRecord) {
        return res.status(400).json({ message: "This user is not currently clocked in" });
      }

      // Double check that this record hasn't already been clocked out
      if (activeRecord.clockOutTime) {
        return res.status(400).json({ message: "This session is already clocked out" });
      }

      const finalClockOutTime = clockOutTime ? new Date(clockOutTime) : new Date();
      const totalMinutes = differenceInMinutes(finalClockOutTime, new Date(activeRecord.clockInTime));
      const totalHours = (totalMinutes / 60).toFixed(2);

      const updatedRecord = await storage.updateAttendanceRecord(activeRecord.id, {
        clockOutTime: finalClockOutTime,
        notes: notes || activeRecord.notes
      });

      console.log(`Manager ${req.user!.email} clocked out user ${userId} from session ${activeRecord.id}`);
      res.json(updatedRecord);
    } catch (error) {
      console.error("Manual clock out error:", error);
      res.status(500).json({ message: "Failed to manually clock out user" });
    }
  });

  // Attendance reporting
  app.get("/api/attendance", requireAuth, async (req, res) => {
    try {
      let records;

      if (req.user!.role === "employee") {
        // Employees see only their own records
        records = await storage.getUserAttendanceRecords(req.user!.id, 30);
      } else {
        // Managers and admins see all records from their organization
        records = await storage.getAllAttendanceRecords(100, req.user!.organizationId!);
      }

      res.json(records);
    } catch (error) {
      console.error("Get attendance error:", error);
      res.status(500).json({ message: "Failed to get attendance records" });
    }
  });

  // Get employee time analytics for managers
  app.get("/api/analytics/employees", requireAdmin, async (req, res) => {
    try {
      // CRITICAL: Only get users from the same organization as the manager
      const employees = await storage.getAllUsers(req.user!.organizationId!);
      const employeeAnalytics = [];

      for (const employee of employees.filter(u => u.role === 'employee')) {
        // Get last 30 days of records
        const records = await storage.getUserAttendanceRecords(employee.id, 50);

        // Calculate this week's hours
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
        const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

        const thisWeekRecords = records.filter(record => {
          const recordDate = new Date(record.date);
          return recordDate >= weekStart && recordDate <= weekEnd && record.clockOutTime;
        });

        const thisWeekHours = thisWeekRecords.reduce((total, record) => {
          if (record.clockOutTime) {
            const minutes = differenceInMinutes(new Date(record.clockOutTime), new Date(record.clockInTime));
            return total + (minutes / 60);
          }
          return total;
        }, 0);

        // Calculate this month's hours
        const monthStart = startOfMonth(new Date());
        const monthEnd = endOfMonth(new Date());

        const thisMonthRecords = records.filter(record => {
          const recordDate = new Date(record.date);
          return recordDate >= monthStart && recordDate <= monthEnd && record.clockOutTime;
        });

        const thisMonthHours = thisMonthRecords.reduce((total, record) => {
          if (record.clockOutTime) {
            const minutes = differenceInMinutes(new Date(record.clockOutTime), new Date(record.clockInTime));
            return total + (minutes / 60);
          }
          return total;
        }, 0);

        // Calculate today's status using single source of truth
        const today = format(new Date(), "yyyy-MM-dd");
        const todayRecords = records.filter(record => record.date === today);

        // Use the global active record check
        const activeRecord = await storage.getActiveAttendanceRecord(employee.id);
        const MAX_SHIFT_MS = 14 * 60 * 60 * 1000;
        const isCurrentlyWorking = !!activeRecord
          && (Date.now() - new Date(activeRecord.clockInTime).getTime()) < MAX_SHIFT_MS;

        const todayHours = todayRecords.reduce((total, record) => {
          if (record.clockOutTime) {
            const minutes = differenceInMinutes(new Date(record.clockOutTime), new Date(record.clockInTime));
            return total + (minutes / 60);
          } else {
            // Cap open session at MAX_SHIFT_HOURS
            const elapsedMs = Date.now() - new Date(record.clockInTime).getTime();
            const cappedMs = Math.min(elapsedMs, MAX_SHIFT_MS);
            return total + (cappedMs / 3600000);
          }
          return total;
        }, 0);

        employeeAnalytics.push({
          id: employee.id,
          name: `${employee.firstName} ${employee.lastName}`,
          email: employee.email,
          thisWeekHours: Math.round(thisWeekHours * 100) / 100,
          thisMonthHours: Math.round(thisMonthHours * 100) / 100,
          todayHours: Math.round(todayHours * 100) / 100,
          isCurrentlyWorking,
          totalRecords: records.length,
          lastClockIn: todayRecords.length > 0 ? todayRecords[todayRecords.length - 1].clockInTime : null
        });
      }

      res.json(employeeAnalytics);
    } catch (error) {
      console.error("Employee analytics error:", error);
      res.status(500).json({ message: "Failed to get employee analytics" });
    }
  });

  // Get detailed employee time records for managers
  app.get("/api/analytics/employee/:id", requireAdmin, async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const { period = 'week' } = req.query;

      // Get employee info
      const employee = await storage.getUserById(employeeId);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }

      // CRITICAL: Ensure the employee belongs to the same organization as the manager
      if (employee.organizationId !== req.user!.organizationId!) {
        return res.status(403).json({ message: "Access denied - employee not in your organization" });
      }

      let startDate: Date;
      let endDate: Date = new Date();

      switch (period) {
        case 'week':
          startDate = startOfWeek(new Date(), { weekStartsOn: 1 });
          endDate = endOfWeek(new Date(), { weekStartsOn: 1 });
          break;
        case 'month':
          startDate = startOfMonth(new Date());
          endDate = endOfMonth(new Date());
          break;
        case 'lastMonth':
          startDate = startOfMonth(subMonths(new Date(), 1));
          endDate = endOfMonth(subMonths(new Date(), 1));
          break;
        default:
          startDate = startOfWeek(new Date(), { weekStartsOn: 1 });
      }

      const records = await storage.getUserAttendanceRecords(employeeId, 100);

      const filteredRecords = records.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate >= startDate && recordDate <= endDate;
      });

      // Group records by date and calculate daily totals
      const dailyGroups = new Map<string, any[]>();
      filteredRecords.forEach(record => {
        const dateKey = record.date;
        if (!dailyGroups.has(dateKey)) {
          dailyGroups.set(dateKey, []);
        }
        dailyGroups.get(dateKey)!.push(record);
      });

      // Calculate daily breakdown with proper grouping
      const MAX_SHIFT_SECONDS = 14 * 3600;
      const MAX_SHIFT_MS = 14 * 60 * 60 * 1000;
      const dailyBreakdown = Array.from(dailyGroups.entries()).map(([date, dayRecords]) => {
        let totalDaySeconds = 0;
        let isCurrentlyWorking = false;
        let hasAutoClockout = false;

        dayRecords.forEach(record => {
          if (record.clockOutTime) {
            const sessionSeconds = differenceInSeconds(new Date(record.clockOutTime), new Date(record.clockInTime));
            totalDaySeconds += sessionSeconds;
          } else {
            const elapsedMs = Date.now() - new Date(record.clockInTime).getTime();
            if (elapsedMs < MAX_SHIFT_MS) {
              isCurrentlyWorking = true;
              totalDaySeconds += Math.floor(elapsedMs / 1000);
            } else {
              totalDaySeconds += MAX_SHIFT_SECONDS;
            }
          }
          if (record.notes && record.notes.includes('Auto clocked out')) {
            hasAutoClockout = true;
          }
        });

        const hoursWorked = Math.floor(totalDaySeconds / 3600);
        const minutesWorked = Math.floor((totalDaySeconds % 3600) / 60);
        const secondsWorked = totalDaySeconds % 60;
        const totalHours = Math.round((hoursWorked + minutesWorked / 60 + secondsWorked / 3600) * 100) / 100;

        return {
          id: dayRecords[0].id,
          date,
          clockInTime: dayRecords[0].clockInTime,
          clockOutTime: dayRecords[dayRecords.length - 1].clockOutTime,
          hoursWorked,
          minutesWorked,
          secondsWorked,
          totalHours,
          isCurrentlyWorking,
          hasAutoClockout,
          sessionCount: dayRecords.length,
          notes: dayRecords.map(r => r.notes).filter(Boolean).join('; ') || null
        };
      });

      // Calculate totals
      const totalHours = dailyBreakdown.reduce((sum, day) => sum + day.totalHours, 0);
      const totalMinutes = Math.floor((totalHours % 1) * 60);
      const totalWholeHours = Math.floor(totalHours);
      const totalSeconds = Math.floor(((totalHours % 1) * 60 % 1) * 60);

      res.json({
        employee: {
          id: employee.id,
          name: `${employee.firstName} ${employee.lastName}`,
          email: employee.email
        },
        period,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        summary: {
          totalHours: Math.round(totalHours * 100) / 100,
          totalWholeHours,
          totalMinutes,
          totalSeconds,
          totalDays: dailyBreakdown.length,
          averageHoursPerDay: dailyBreakdown.length > 0 ? Math.round((totalHours / dailyBreakdown.length) * 100) / 100 : 0
        },
        dailyRecords: dailyBreakdown.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      });
    } catch (error) {
      console.error("Employee detail analytics error:", error);
      res.status(500).json({ message: "Failed to get employee details" });
    }
  });

  // Get personal analytics for employees
  app.get("/api/analytics/personal", requireAuth, async (req, res) => {
    try {
      const { period = 'week' } = req.query;

      let startDate: Date;
      let endDate: Date = new Date();

      switch (period) {
        case 'week':
          startDate = startOfWeek(new Date(), { weekStartsOn: 1 });
          endDate = endOfWeek(new Date(), { weekStartsOn: 1 });
          break;
        case 'month':
          startDate = startOfMonth(new Date());
          endDate = endOfMonth(new Date());
          break;
        case 'lastMonth':
          startDate = startOfMonth(subMonths(new Date(), 1));
          endDate = endOfMonth(subMonths(new Date(), 1));
          break;
        default:
          startDate = startOfWeek(new Date(), { weekStartsOn: 1 });
      }

      const records = await storage.getUserAttendanceRecords(req.user!.id, 100);

      const filteredRecords = records.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate >= startDate && recordDate <= endDate;
      });

      // Group records by date and calculate daily totals
      const dailyGroups = new Map<string, any[]>();
      filteredRecords.forEach(record => {
        const dateKey = record.date;
        if (!dailyGroups.has(dateKey)) {
          dailyGroups.set(dateKey, []);
        }
        dailyGroups.get(dateKey)!.push(record);
      });

      // Calculate daily breakdown with proper grouping
      const MAX_SHIFT_SECONDS = 14 * 3600;
      const MAX_SHIFT_MS = 14 * 60 * 60 * 1000;

      const dailyBreakdown = Array.from(dailyGroups.entries()).map(([date, dayRecords]) => {
        let totalDaySeconds = 0;
        let isCurrentlyWorking = false;
        let hasAutoClockout = false;
        let clockInTimes: string[] = [];
        let clockOutTimes: string[] = [];

        dayRecords.forEach(record => {
          // Send raw ISO times — client formats in local timezone
          clockInTimes.push(new Date(record.clockInTime).toISOString());

          if (record.clockOutTime) {
            clockOutTimes.push(new Date(record.clockOutTime).toISOString());
            const sessionSeconds = differenceInSeconds(new Date(record.clockOutTime), new Date(record.clockInTime));
            totalDaySeconds += sessionSeconds;
          } else {
            // Open record — cap at MAX_SHIFT_HOURS
            const elapsedMs = Date.now() - new Date(record.clockInTime).getTime();
            if (elapsedMs < MAX_SHIFT_MS) {
              isCurrentlyWorking = true;
              totalDaySeconds += Math.floor(elapsedMs / 1000);
            } else {
              // Stale open record — count at most MAX_SHIFT_HOURS
              totalDaySeconds += MAX_SHIFT_SECONDS;
            }
          }

          // Flag auto-clockout notes
          if (record.notes && record.notes.includes('Auto clocked out')) {
            hasAutoClockout = true;
          }
        });

        const hoursWorked = Math.floor(totalDaySeconds / 3600);
        const minutesWorked = Math.floor((totalDaySeconds % 3600) / 60);
        const secondsWorked = totalDaySeconds % 60;
        const totalHours = Math.round((hoursWorked + minutesWorked / 60 + secondsWorked / 3600) * 100) / 100;

        return {
          id: dayRecords[0].id,
          date,
          clockInTime: dayRecords[0].clockInTime,
          clockOutTime: dayRecords[dayRecords.length - 1].clockOutTime,
          hoursWorked,
          minutesWorked,
          secondsWorked,
          totalHours,
          isCurrentlyWorking,
          hasAutoClockout,
          clockInFormatted: clockInTimes.join(', '),
          clockOutFormatted: clockOutTimes.length > 0 ? clockOutTimes.join(', ') : null,
          dateFormatted: format(new Date(date), 'MMM dd, yyyy'),
          sessionCount: dayRecords.length,
          notes: dayRecords.map(r => r.notes).filter(Boolean).join('; ') || null
        };
      });

      // Calculate totals — Days Worked = distinct dates with closed or valid-open records
      const totalHours = dailyBreakdown.reduce((sum, day) => sum + day.totalHours, 0);
      const totalMinutes = Math.floor((totalHours % 1) * 60);
      const totalWholeHours = Math.floor(totalHours);
      const totalSeconds = Math.floor(((totalHours % 1) * 60 % 1) * 60);

      // "Days worked" = days with closed records or valid in-progress sessions
      const daysWorked = dailyBreakdown.filter(d =>
        d.clockOutTime || d.isCurrentlyWorking
      ).length;

      // Use getActiveAttendanceRecord for global "currently working" status
      const activeRecord = await storage.getActiveAttendanceRecord(req.user!.id);
      const globalIsWorking = !!activeRecord
        && (Date.now() - new Date(activeRecord.clockInTime).getTime()) < MAX_SHIFT_MS;

      res.json({
        period,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        summary: {
          totalHours: Math.round(totalHours * 100) / 100,
          totalWholeHours,
          totalMinutes,
          totalSeconds,
          totalDays: daysWorked || dailyBreakdown.length,
          averageHoursPerDay: daysWorked > 0 ? Math.round((totalHours / daysWorked) * 100) / 100 : 0,
          isCurrentlyWorking: globalIsWorking,
          currentSessionStart: activeRecord?.clockInTime || null
        },
        dailyRecords: dailyBreakdown.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      });
    } catch (error) {
      console.error("Personal analytics error:", error);
      res.status(500).json({ message: "Failed to get personal analytics" });
    }
  });

  app.get("/api/attendance/today", requireAuth, async (req, res) => {
    try {
      const today = format(new Date(), "yyyy-MM-dd");

      // Get all records for today
      const records = await storage.getUserAttendanceRecords(req.user!.id, 10);
      const todayRecords = records.filter(record => record.date === today);

      // Single source of truth: find ANY open record regardless of date
      const activeRecord = await storage.getActiveAttendanceRecord(req.user!.id);

      // An open record older than MAX_SHIFT_HOURS is a forgotten clock-out, not "working"
      const MAX_SHIFT_MS = 14 * 60 * 60 * 1000;
      const isActiveValid = activeRecord
        ? (Date.now() - new Date(activeRecord.clockInTime).getTime()) < MAX_SHIFT_MS
        : false;

      res.json({
        record: todayRecords[0] || null,
        records: todayRecords,
        activeRecord: activeRecord || null,
        isClockedIn: !!activeRecord && isActiveValid,
        hasForgottenClockOut: !!activeRecord && !isActiveValid
      });
    } catch (error) {
      console.error("Get today attendance error:", error);
      res.status(500).json({ message: "Failed to get today's attendance" });
    }
  });

  // Delete user with role-based permissions
  app.delete("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);

      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      // Check if user exists
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prevent deleting yourself
      if (userId === req.user!.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      // Role-based deletion permissions
      const currentUserRole = req.user!.role;
      const targetUserRole = targetUser.role;

      // No one can delete admin
      if (targetUserRole === "admin") {
        return res.status(403).json({ message: "Cannot delete admin users" });
      }

      // Only admin can delete managers
      if (targetUserRole === "manager" && currentUserRole !== "admin") {
        return res.status(403).json({ message: "Only admin can delete managers" });
      }

      // Managers can only delete employees, admins can delete anyone (except admin)
      if (currentUserRole === "manager" && targetUserRole !== "employee") {
        return res.status(403).json({ message: "Managers can only delete employees" });
      }

      // Employees cannot delete anyone
      if (currentUserRole === "employee") {
        return res.status(403).json({ message: "Employees cannot delete users" });
      }

      await storage.deleteUser(userId);
      console.log(`User ${targetUser.email} (${targetUserRole}) deleted by ${req.user!.email} (${currentUserRole})`);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Employee management (Manager/Admin only)
  app.get("/api/employees", requireAuth, async (req, res) => {
    try {
      // Check if user is manager or admin
      if (req.user!.role !== 'manager' && req.user!.role !== 'admin') {
        return res.status(403).json({ message: "Manager access required" });
      }

      // Get all users from the same organization for managers/admins to see
      const allUsers = await storage.getAllUsers(req.user!.organizationId!);

      // Remove passwords from response
      res.json(allUsers.map(toSafeUser));
    } catch (error) {
      console.error("Get employees error:", error);
      res.status(500).json({ message: "Failed to get employees" });
    }
  });

  app.post("/api/employees", requireAuth, async (req, res) => {
    try {
      // Check if user is manager or admin
      if (req.user!.role !== 'manager' && req.user!.role !== 'admin') {
        return res.status(403).json({ message: "Manager access required" });
      }

      const { firstName, lastName, email, role } = req.body;

      // Validate required fields
      if (!firstName || !lastName || !email) {
        return res.status(400).json({ message: "First name, last name, and email are required" });
      }

      // Role-based permissions: only admin can create managers
      if (role === 'manager' && req.user!.role !== 'admin') {
        return res.status(403).json({ message: "Only admin can create manager accounts" });
      }

      // Check if user already exists in this organization
      const existingUser = await storage.getUserByEmail(email, req.user!.organizationId!);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists in this organization" });
      }

      // Create default password (can be changed later)
      const defaultPassword = "password123";
      const hashedPassword = await hashPassword(defaultPassword);

      // Create the employee directly with organization ID
      const newUser = await storage.createUser({
        firstName,
        lastName,
        email,
        password: hashedPassword,
        role: role || "employee",
        organizationId: req.user!.organizationId!, // Assign to same organization as the creating user
        isActive: true,
        faceImageUrl: null,
        faceEmbedding: null
      });

      res.json({
        message: "Employee created successfully",
        user: toSafeUser(newUser),
        defaultPassword: defaultPassword,
        note: "Employee can change password after first login"
      });
    } catch (error) {
      console.error("Create employee error:", error);
      res.status(500).json({ message: "Failed to create employee" });
    }
  });

  app.delete("/api/employees/:id", requireAuth, async (req, res) => {
    try {
      // Check if user is admin (only admins can delete employees)
      if (req.user!.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const employeeId = parseInt(req.params.id);

      // Get the employee to be deleted
      const employee = await storage.getUser(employeeId);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }

      // Check if employee belongs to the same organization
      if (employee.organizationId !== req.user!.organizationId!) {
        return res.status(403).json({ message: "Cannot delete employee from different organization" });
      }

      // Cannot delete admin users
      if (employee.role === 'admin') {
        return res.status(403).json({ message: "Cannot delete admin users" });
      }

      // Delete the employee
      await storage.deleteUser(employeeId);

      console.log(`Employee ${employee.email} (${employee.role}) deleted by admin ${req.user!.email}`);
      res.json({ message: "Employee deleted successfully" });
    } catch (error) {
      console.error("Delete employee error:", error);
      res.status(500).json({ message: "Failed to delete employee" });
    }
  });

  // Employee invitation system
  app.post("/api/create-invitation", requireAuth, async (req, res) => {
    try {
      // Check if user is manager or admin
      if (req.user!.role !== 'manager' && req.user!.role !== 'admin') {
        return res.status(403).json({ message: "Manager or Admin access required" });
      }

      const { email, role } = req.body;

      // Check role permissions: only admin can invite managers
      if (role === 'manager' && req.user!.role !== 'admin') {
        return res.status(403).json({ message: "Only admin can create manager invitations" });
      }

      // Check if user already exists in this organization
      const existingUser = await storage.getUserByEmail(email, req.user!.organizationId!);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists in this organization" });
      }

      // Generate secure token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const invitation = await storage.createInvitation({
        organizationId: req.user!.organizationId!,
        email,
        role: role || "employee",
        invitedBy: req.user!.id,
        expiresAt,
        token
      });

      // Fire-and-forget: send invitation email (don't block the response)
      storage.getOrganization(req.user!.organizationId!).then((org) => {
        const inviterName = `${req.user!.firstName} ${req.user!.lastName}`;
        const organisationName = org?.name || "your organisation";
        sendInvitationEmail({
          to: email,
          inviterName,
          organisationName,
          token,
          role: role || "employee",
        }).catch(console.error);
      }).catch(console.error);

      res.json({
        ...invitation,
        invitationUrl: `${req.protocol}://${req.hostname}/register?token=${token}`
      });
    } catch (error) {
      console.error("Create invitation error:", error);
      res.status(500).json({ message: "Failed to create invitation" });
    }
  });

  app.get("/api/invitations", requireAuth, async (req, res) => {
    try {
      // Check if user is manager or admin
      if (req.user!.role !== 'manager' && req.user!.role !== 'admin') {
        return res.status(403).json({ message: "Manager or Admin access required" });
      }

      const invitations = await storage.getActiveInvitations(req.user!.organizationId!);
      res.json(invitations);
    } catch (error) {
      console.error("Get invitations error:", error);
      res.status(500).json({ message: "Failed to get invitations" });
    }
  });

  app.post("/api/register-with-token", async (req, res) => {
    try {
      const { token, firstName, lastName, password, faceImageData } = req.body;

      // Validate invitation token
      const invitation = await storage.getInvitationByToken(token);
      if (!invitation) {
        return res.status(400).json({ message: "Invalid or expired invitation" });
      }

      if (new Date() > invitation.expiresAt) {
        return res.status(400).json({ message: "Invitation has expired" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(invitation.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user with face image
      const user = await storage.createUser({
        email: invitation.email,
        firstName,
        lastName,
        password: hashedPassword,
        role: invitation.role ?? undefined,
        faceImageUrl: faceImageData || null,
      });

      // Mark invitation as used
      await storage.markInvitationUsed(invitation.id);

      // Set session
      (req.session as any).userId = user.id;

      res.json(toSafeUser(user));
    } catch (error) {
      console.error("Register with token error:", error);
      res.status(400).json({ message: "Registration failed" });
    }
  });

  // Developer authentication route
  // Organization lookup by slug (safe — does not enumerate orgs)
  app.get("/api/org/by-slug/:slug", async (req, res) => {
    try {
      const orgs = await storage.getAllOrganizations();
      const org = orgs.find(o => (o as any).slug === req.params.slug || o.domain === req.params.slug);
      if (!org) {
        return res.status(404).json({ message: "Organisation not found" });
      }
      // Return only safe public fields
      res.json({ id: org.id, name: org.name });
    } catch (error) {
      console.error("Org lookup error:", error);
      res.status(500).json({ message: "Failed to look up organisation" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
