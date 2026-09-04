// SPDX-License-Identifier: GPL-3.0-only
import { loc_2009, SAUCER_TIMER, loc_2083, TIMER_RELOAD } from "./names.js";

/**
 * tickSaucerSpawnTimer — run the free-running countdown that schedules the next mystery saucer.
 *
 * WHAT IT IS
 *   A rolling 16-bit timer that decides when a flying saucer may appear. Each pass, while its gate cell is
 *   low, it counts the timer down by one; when the count reaches zero it reloads the timer to a fixed
 *   interval and raises the saucer-arm flag, giving the saucer a steady, free-running cadence.
 *
 * ROLE IN THE MACHINE
 *   Part of the vblank object tail (mechanisms.md, frame tasks/timers). SAUCER_TIMER (0x2091) is the
 *   16-bit countdown (not itself a sound cell); TIMER_RELOAD (0x0600) is the reload interval. The arm flag
 *   it raises is loc_2083 — the saucer object-record base whose first byte the saucer handler tests
 *   (loc_2083 == 0 means "no saucer armed"). loc_2009 is the gate: it ticks the timer only while that cell
 *   sits below 0x78 (loc_2009 is the reference-alien / fleet-position anchor low byte; its exact role is
 *   not fully grounded, so it keeps a placeholder name). loc_2083 likewise keeps a placeholder name.
 *
 * ROM 0x0913-....  Grounding: [seen].
 *
 * LIVE-OUT: memory only (the decremented timer and, on wrap, the arm flag).
 */
export function tickSaucerSpawnTimer(m) {
  // Gate: only advance the timer while loc_2009 is below 0x78; otherwise leave it frozen this pass.
  if (m.mem8[loc_2009] >= 0x78) return;
  // Read the rolling countdown.
  let n = m.mem16[SAUCER_TIMER];
  // On wrap (reached zero): reload to the fixed interval and raise the saucer-arm flag so the handler can
  // launch a saucer.
  if (n === 0) {
    n = TIMER_RELOAD;
    m.mem8[loc_2083] = 1;
  }
  // Store the decremented value back (n-1), so a just-reloaded timer starts one below the reload constant.
  m.mem16[SAUCER_TIMER] = n - 1;
}
