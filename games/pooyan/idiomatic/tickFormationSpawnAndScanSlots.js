// SPDX-License-Identifier: GPL-3.0-only
import { loc_2bbf } from "./loc_2bbf.js";
import { scanFormationSlotsAndLaunchFree } from "./scanFormationSlotsAndLaunchFree.js";
import { WAVE_ARRIVAL_COUNTER, FORMATION_SPAWN_TIMER, FORMATION_SPAWN_TABLE } from "./names.js";
/**
 * tickFormationSpawnAndScanSlots — formation-spawn tick. While the wave-arrival count is still low (< 2) it runs the
 * ready-sprite helper; if that helper signals the indicator is already painted the whole tick
 * is abandoned. Then it services the formation spawn countdown: while the countdown is nonzero
 * it just decrements it and returns; when it reaches zero it points at the formation record
 * table and runs the spawn scan.
 *
 * LIVE-OUT: memory only — callers do not read back a register result from the tick.
 */

const WAVE_LOW = 0x02; // ready-sprite helper runs only while the wave count is below this
const RECORD_STRIDE = -0x18; // one record back (24 bytes) each spawn-scan pass

export function tickFormationSpawnAndScanSlots(m) {
  const { mem8 } = m;

  const wave = mem8[WAVE_ARRIVAL_COUNTER];
  if (wave < WAVE_LOW) {
    if (!loc_2bbf(m, wave)) return; // indicator already painted -> abandon the tick
  }

  const countdown = mem8[FORMATION_SPAWN_TIMER];
  if (countdown !== 0) {
    mem8[FORMATION_SPAWN_TIMER] = countdown - 1; // still counting down
    return;
  }

  // countdown expired: scan the formation record table for a free slot
  return scanFormationSlotsAndLaunchFree(m, FORMATION_SPAWN_TABLE, RECORD_STRIDE);
}
