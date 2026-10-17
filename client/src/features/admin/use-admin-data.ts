import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { SafeUser, Location, EmployeeLocationAssignment, EmployeeInvitation, AttendanceRecord } from "@/lib/types";

export const useEmployees = () =>
  useQuery<SafeUser[]>({ queryKey: ["/api/employees"], queryFn: () => apiRequest("/api/employees") });

export const useLocations = () =>
  useQuery<Location[]>({ queryKey: ["/api/locations"], queryFn: () => apiRequest("/api/locations") });

export const useAssignments = () =>
  useQuery<EmployeeLocationAssignment[]>({ queryKey: ["/api/employee-locations"], queryFn: () => apiRequest("/api/employee-locations") });

export const useInvitations = () =>
  useQuery<EmployeeInvitation[]>({ queryKey: ["/api/invitations"], queryFn: () => apiRequest("/api/invitations") });

export const useAttendance = () =>
  useQuery<AttendanceRecord[]>({ queryKey: ["/api/attendance"], queryFn: () => apiRequest("/api/attendance") });

export interface OrgInfo {
  id: number;
  name: string;
  slug: string;
  logoUrl?: string | null;
  brandColor?: string | null;
  wallpaperUrl?: string | null;
  wallpaperPreset?: string | null;
  welcomeTitle?: string | null;
  welcomeMessage?: string | null;
  latenessGraceMinutes?: number;
  timezone?: string;
}

export const useOrganization = () =>
  useQuery<OrgInfo>({ queryKey: ["/api/organization"], queryFn: () => apiRequest("/api/organization") });
