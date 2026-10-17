import type { Express, Request, Response } from "express";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../auth";
import { storage } from "../storage";
import { weeklyContractSchema, shiftUpsertSchema, dateKey as dateKeySchema } from "@shared/schema";
import { buildRota, statusLabel, type DayCell } from "../lib/scheduling";
import { addDays, dateRange, localDateKey, startOfWeek, DEFAULT_TZ } from "../lib/time";

const rangeQuery = z.object({ from: dateKeySchema.optional(), to: dateKeySchema.optional() });

async function orgContext(orgId: number) {
  const org = await storage.getOrganization(orgId);
  return { tz: org?.timezone || DEFAULT_TZ, grace: org?.latenessGraceMinutes ?? 5, org };
}

function resolveRange(q: { from?: string; to?: string }, tz: string) {
  const today = localDateKey(new Date(), tz);
  const from = q.from ?? startOfWeek(today);
  const to = q.to ?? addDays(from, 6);
  if (to < from) throw Object.assign(new Error("'to' must not be before 'from'"), { status: 400 });
  if (dateRange(from, to).length > 62) throw Object.assign(new Error("Range too large (max 62 days)"), { status: 400 });
  return { from, to, today };
}

const cellOut = (c: DayCell) => ({ shift: c.shift, evaluation: c.evaluation, label: statusLabel(c.evaluation, c.shift) });

export function registerScheduleRoutes(app: Express) {
  // ── Weekly contracts ──
  app.get("/api/schedules/contracts", requireAdmin, async (req: Request, res: Response) => {
    try {
      const rows = await storage.getShiftTemplatesForOrg(req.user!.organizationId!);
      const contracts: Record<number, { days: any[]; effectiveFrom: string | null; effectiveTo: string | null }> = {};
      for (const r of rows) {
        const c = (contracts[r.userId] ??= { days: [], effectiveFrom: r.effectiveFrom ?? null, effectiveTo: r.effectiveTo ?? null });
        c.days.push({ dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime, locationId: r.locationId ?? null });
      }
      res.json({ contracts });
    } catch (error) {
      console.error("Contracts list error:", error);
      res.status(500).json({ message: "Failed to load contracts" });
    }
  });

  app.put("/api/schedules/contracts/:userId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId, 10);
      const target = await storage.getUser(userId);
      if (!target || target.organizationId !== req.user!.organizationId) return res.status(404).json({ message: "Employee not found" });
      const data = weeklyContractSchema.parse(req.body ?? {});
      const rows = await storage.replaceShiftTemplatesForUser(
        req.user!.organizationId!,
        userId,
        data.days.map((d) => ({ dayOfWeek: d.dayOfWeek, startTime: d.startTime, endTime: d.endTime, locationId: d.locationId ?? null, effectiveFrom: data.effectiveFrom ?? null, effectiveTo: data.effectiveTo ?? null }))
      );
      res.json({ userId, days: rows.map((r) => ({ dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime, locationId: r.locationId ?? null })), effectiveFrom: data.effectiveFrom ?? null, effectiveTo: data.effectiveTo ?? null });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0]?.message || "Invalid contract", errors: error.errors });
      console.error("Contract save error:", error);
      res.status(500).json({ message: "Failed to save contract" });
    }
  });

  app.delete("/api/schedules/contracts/:userId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId, 10);
      const target = await storage.getUser(userId);
      if (!target || target.organizationId !== req.user!.organizationId) return res.status(404).json({ message: "Employee not found" });
      await storage.deleteShiftTemplatesForUser(userId);
      res.json({ message: "Contract removed" });
    } catch (error) {
      console.error("Contract delete error:", error);
      res.status(500).json({ message: "Failed to remove contract" });
    }
  });

  // ── One-off shifts / overrides ──
  app.get("/api/schedules/shifts", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { tz } = await orgContext(req.user!.organizationId!);
      const { from, to } = resolveRange(rangeQuery.parse(req.query), tz);
      res.json(await storage.getShiftsForOrg(req.user!.organizationId!, from, to));
    } catch (error: any) {
      res.status(error?.status || 500).json({ message: error?.message || "Failed to load shifts" });
    }
  });

  app.post("/api/schedules/shifts", requireAdmin, async (req: Request, res: Response) => {
    try {
      const data = shiftUpsertSchema.parse(req.body ?? {});
      const target = await storage.getUser(data.userId);
      if (!target || target.organizationId !== req.user!.organizationId) return res.status(404).json({ message: "Employee not found" });
      const row = await storage.upsertShift({
        organizationId: req.user!.organizationId!,
        userId: data.userId,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        locationId: data.locationId ?? null,
        status: data.status ?? "scheduled",
        notes: data.notes ?? null,
        createdBy: req.user!.id,
      });
      res.json(row);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0]?.message || "Invalid shift", errors: error.errors });
      console.error("Shift save error:", error);
      res.status(500).json({ message: "Failed to save shift" });
    }
  });

  app.delete("/api/schedules/shifts/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const shift = await storage.getShift(id);
      if (!shift || shift.organizationId !== req.user!.organizationId) return res.status(404).json({ message: "Shift not found" });
      await storage.deleteShift(id);
      res.json({ message: "Shift removed" });
    } catch (error) {
      console.error("Shift delete error:", error);
      res.status(500).json({ message: "Failed to remove shift" });
    }
  });

  // ── Rota grid (admin) ──
  app.get("/api/rota", requireAdmin, async (req: Request, res: Response) => {
    try {
      const orgId = req.user!.organizationId!;
      const { tz, grace } = await orgContext(orgId);
      const { from, to, today } = resolveRange(rangeQuery.parse(req.query), tz);
      const [users, templates, overrides, records] = await Promise.all([
        storage.getAllUsers(orgId),
        storage.getShiftTemplatesForOrg(orgId),
        storage.getShiftsForOrg(orgId, from, to),
        storage.getAttendanceForOrgRange(orgId, from, to),
      ]);
      const staff = users.filter((u) => u.isActive && (u.role === "employee" || templates.some((t) => t.userId === u.id) || overrides.some((s) => s.userId === u.id)));
      const rota = buildRota({ userIds: staff.map((u) => u.id), from, to, templates, overrides, records, graceMinutes: grace, tz });
      res.json({
        from,
        to,
        today,
        timezone: tz,
        graceMinutes: grace,
        days: dateRange(from, to),
        employees: staff
          .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
          .map((u) => ({
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            role: u.role,
            hasContract: templates.some((t) => t.userId === u.id),
            days: Object.fromEntries(Object.entries(rota[u.id]).map(([d, c]) => [d, cellOut(c)])),
          })),
      });
    } catch (error: any) {
      console.error("Rota error:", error);
      res.status(error?.status || 500).json({ message: error?.message || "Failed to load rota" });
    }
  });

  // ── Own shifts (any user) ──
  app.get("/api/my-shifts", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = req.user!.organizationId!;
      const { tz, grace } = await orgContext(orgId);
      const { from, to, today } = resolveRange(rangeQuery.parse(req.query), tz);
      const [templates, overrides, records] = await Promise.all([
        storage.getShiftTemplatesForUser(req.user!.id),
        storage.getShiftsForUser(req.user!.id, from, to),
        storage.getAttendanceForUserRange(req.user!.id, from, to),
      ]);
      const rota = buildRota({ userIds: [req.user!.id], from, to, templates, overrides, records, graceMinutes: grace, tz });
      res.json({
        from,
        to,
        today,
        timezone: tz,
        graceMinutes: grace,
        hasContract: templates.length > 0,
        days: dateRange(from, to).map((d) => ({ date: d, ...cellOut(rota[req.user!.id][d]) })),
      });
    } catch (error: any) {
      res.status(error?.status || 500).json({ message: error?.message || "Failed to load shifts" });
    }
  });

  // ── Today at a glance (admin overview) ──
  app.get("/api/dashboard/today", requireAdmin, async (req: Request, res: Response) => {
    try {
      const orgId = req.user!.organizationId!;
      const { tz, grace } = await orgContext(orgId);
      const today = localDateKey(new Date(), tz);
      const [users, templates, overrides, records] = await Promise.all([
        storage.getAllUsers(orgId),
        storage.getShiftTemplatesForOrg(orgId),
        storage.getShiftsForOrg(orgId, today, today),
        storage.getAttendanceForOrgRange(orgId, today, today),
      ]);
      const staff = users.filter((u) => u.isActive && u.role === "employee");
      const rota = buildRota({ userIds: staff.map((u) => u.id), from: today, to: today, templates, overrides, records, graceMinutes: grace, tz });
      const person = (u: (typeof staff)[number]) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email });
      const rows = staff.map((u) => ({ user: person(u), ...cellOut(rota[u.id][today]) }));
      const scheduled = rows.filter((r) => r.shift && r.shift.status !== "cancelled");
      res.json({
        date: today,
        timezone: tz,
        graceMinutes: grace,
        counts: {
          employees: staff.length,
          scheduled: scheduled.length,
          onShift: rows.filter((r) => r.evaluation?.onShiftNow).length,
          late: rows.filter((r) => r.evaluation?.status === "late").length,
          noShow: rows.filter((r) => r.evaluation?.status === "no_show").length,
          upcoming: rows.filter((r) => r.evaluation?.status === "upcoming").length,
        },
        late: rows.filter((r) => r.evaluation?.status === "late"),
        noShows: rows.filter((r) => r.evaluation?.status === "no_show"),
        onShift: rows.filter((r) => r.evaluation?.onShiftNow),
        upcoming: rows.filter((r) => r.evaluation?.status === "upcoming"),
        unscheduled: rows.filter((r) => r.evaluation?.status === "unscheduled"),
      });
    } catch (error) {
      console.error("Dashboard today error:", error);
      res.status(500).json({ message: "Failed to load today's summary" });
    }
  });
}
