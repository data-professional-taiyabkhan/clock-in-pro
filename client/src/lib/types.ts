import type { User, Location, EmployeeInvitation, AttendanceRecord } from "@shared/schema";

/** What /api/user and /api/employees return: a User without secrets, plus derived flags. */
export type SafeUser = Omit<User, "password" | "faceEmbedding" | "pinHash"> & {
  faceRegistered: boolean;
};

export type EmployeeLocationAssignment = {
  id: number;
  userId: number;
  locationId: number;
  user: SafeUser;
  location: Location;
};

export type { Location, EmployeeInvitation, AttendanceRecord };

export const fullName = (u?: Pick<SafeUser, "firstName" | "lastName"> | null) =>
  u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() : "";

export const initials = (u?: Pick<SafeUser, "firstName" | "lastName"> | null) =>
  u ? `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase() : "?";

/** Strip the "400: " prefix apiRequest puts on error messages. */
export const cleanError = (e: unknown) => (e instanceof Error ? e.message.replace(/^\d+:\s*/, "") : String(e));
