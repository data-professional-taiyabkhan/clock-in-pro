/**
 * Auto-clockout sweeper — closes shifts left open past MAX_SHIFT_HOURS.
 * Runs once on boot (heals dangling records immediately) and hourly.
 */
import { storage } from "../storage";

/** Maximum shift duration in hours. Open records older than this are auto-closed. */
export const MAX_SHIFT_HOURS = 14;

async function runAutoClockout(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - MAX_SHIFT_HOURS * 60 * 60 * 1000);
    const staleRecords = await storage.getOpenAttendanceRecords(cutoff);

    if (staleRecords.length === 0) return;

    console.log(`[auto-clockout] Found ${staleRecords.length} open record(s) older than ${MAX_SHIFT_HOURS}h — closing…`);

    for (const record of staleRecords) {
      const autoClockOutTime = new Date(
        new Date(record.clockInTime).getTime() + MAX_SHIFT_HOURS * 60 * 60 * 1000
      );

      const existingNotes = record.notes || "";
      const autoNote = `Auto clocked out after ${MAX_SHIFT_HOURS}h — employee did not clock out; please verify actual end time.`;
      const notes = existingNotes ? `${existingNotes}; ${autoNote}` : autoNote;

      await storage.updateAttendanceRecord(record.id, {
        clockOutTime: autoClockOutTime,
        notes,
      });

      console.log(
        `[auto-clockout] Closed record #${record.id} (user ${record.userId}): ` +
        `clock-in ${record.clockInTime} → auto clock-out ${autoClockOutTime.toISOString()}`
      );
    }

    console.log(`[auto-clockout] Done — ${staleRecords.length} record(s) closed.`);
  } catch (error) {
    console.error("[auto-clockout] Sweeper error:", error);
  }
}

export function startAutoClockoutJob(): void {
  const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  // Run once on boot (delayed 15s to let DB connect)
  setTimeout(runAutoClockout, 15_000);

  // Then run every hour
  setInterval(runAutoClockout, INTERVAL_MS);
  console.log(`[auto-clockout] Job scheduled (every ${INTERVAL_MS / 60000}min, MAX_SHIFT_HOURS=${MAX_SHIFT_HOURS})`);
}
