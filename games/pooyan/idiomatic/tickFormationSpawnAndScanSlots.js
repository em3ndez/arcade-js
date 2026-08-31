// SPDX-License-Identifier: GPL-3.0-only
import { stageFormationReadyMarkersOrSkipTick } from "./stageFormationReadyMarkersOrSkipTick.js";
import { scanFormationSlotsAndLaunchFree } from "./scanFormationSlotsAndLaunchFree.js";
import { WAVE_ARRIVAL_COUNTER, FORMATION_SPAWN_TIMER, FORMATION_SPAWN_TABLE } from "./names.js";
/**
 * tickFormationSpawnAndScanSlots — the per-frame formation-spawn tick.
 *
 * WHAT IT IS
 *   One small driver that decides, on every frame, whether a new formation object should
 *   enter the play field. Formation objects are the enemies (birds) that stream in wave
 *   after wave. This tick does three things in order:
 *     1. At the very start of a wave (while few enemies have arrived) it keeps the on-screen
 *        "ready" markers in sync, and lets the wave short-circuit the tick once it is fully
 *        staged.
 *     2. It runs the inter-launch countdown that paces how often objects appear — while the
 *        countdown is still ticking it simply decrements it and does nothing else this frame.
 *     3. When the countdown hits zero it hands off to the slot scan, which finds a free
 *        record and launches exactly one new formation object.
 *
 * ROLE IN THE MACHINE
 *   This is the pacing valve for enemy arrivals. The play field never fills instantly; the
 *   spawn countdown FORMATION_SPAWN_TIMER (0x8d30) meters the arrivals, and this tick is what
 *   turns each frame into either "still waiting", "still staging the wave", or "time to
 *   launch one". It sits above two helpers — the ready-sprite staging helper (stageFormationReadyMarkersOrSkipTick) that
 *   handles the pre-flight markers, and the slot scan (scanFormationSlotsAndLaunchFree) that
 *   performs the actual launch.
 *
 * ROM ADDRESS: 0x2b9a–0x2bb2.
 *
 * GROUNDING: [seen]. Every cell and helper it touches is [seen]: the per-stage arrival count
 *   WAVE_ARRIVAL_COUNTER (0x8903), the spawn countdown FORMATION_SPAWN_TIMER (0x8d30), the
 *   record table FORMATION_SPAWN_TABLE (0x8c60), the ready-sprite helper stageFormationReadyMarkersOrSkipTick (0x2bbf),
 *   and the slot scan scanFormationSlotsAndLaunchFree (0x2bb3).
 *
 * LIVE-OUT (memory only — no register result is read back by the caller):
 *   • While staging a wave: whatever the ready-sprite helper paints (the formation indicator
 *     and/or ready-sprite squares in video RAM).
 *   • While the countdown is nonzero: FORMATION_SPAWN_TIMER (0x8d30) decremented by one.
 *   • When the countdown expires: whatever the slot scan writes on a launch — the claimed
 *     record's fields, WAVE_ARRIVAL_COUNTER (0x8903), and FORMATION_SPAWN_TIMER (0x8d30)
 *     reloaded with the next inter-launch delay. A frame that launches nothing writes nothing.
 */

// Threshold on the per-stage arrival count WAVE_ARRIVAL_COUNTER (0x8903): the ready-sprite
// staging helper only runs while the count is BELOW this, i.e. the count is 0 or 1. That is
// the narrow window at the very start of a wave when the "ready" markers still need attention;
// once two or more enemies have arrived the wave is underway and the markers are left alone.
const WAVE_LOW = 0x02; // ready-sprite helper runs only while the wave count is below this
// Signed step between consecutive formation records. The records in FORMATION_SPAWN_TABLE
// (0x8c60) are 0x18 (24) bytes wide and the scan walks DOWNWARD through them, so each pass
// subtracts one record's width from the table pointer. Passed straight to the slot scan as
// its stride (the machine expresses it as DE = 0xffe8, the two's-complement of 0x18).
const RECORD_STRIDE = -0x18; // one record back (24 bytes) each spawn-scan pass

export function tickFormationSpawnAndScanSlots(m) {
  const { mem8 } = m;

  // --- Step 1: pre-flight the wave's on-screen "ready" markers. ---
  // Read the per-stage arrival count WAVE_ARRIVAL_COUNTER (0x8903) — how many enemies have
  // arrived so far this stage. Only during the opening of a wave (count below WAVE_LOW, i.e.
  // 0 or 1) do the ready markers still need staging, so only then do we call the helper.
  const wave = mem8[WAVE_ARRIVAL_COUNTER];
  if (wave < WAVE_LOW) {
    // Run the ready-sprite staging helper (stageFormationReadyMarkersOrSkipTick, 0x2bbf), fed the arrival count. It
    // makes sure the correct marker artwork is on screen for the wave, and returns a
    // boolean: true = normal (keep going with the tick), false = the formation indicator is
    // already fully staged this frame, so abandon the whole tick and try again next frame.
    if (!stageFormationReadyMarkersOrSkipTick(m, wave)) return; // indicator already painted -> abandon the tick
  }

  // --- Step 2: service the inter-launch spawn countdown. ---
  // Read the formation-spawn countdown FORMATION_SPAWN_TIMER (0x8d30). This is the pacer that
  // spaces out arrivals; it is reloaded to an inter-launch delay after each launch.
  const countdown = mem8[FORMATION_SPAWN_TIMER];
  if (countdown !== 0) {
    // Still counting down toward the next launch: burn one frame off the timer at 0x8d30 and
    // do nothing else this frame. No object is launched until the timer reaches zero.
    mem8[FORMATION_SPAWN_TIMER] = countdown - 1; // still counting down
    return;
  }

  // --- Step 3: the countdown expired — try to launch one object. ---
  // Hand off to the slot scan (scanFormationSlotsAndLaunchFree, 0x2bb3), seeding it with the
  // record table base FORMATION_SPAWN_TABLE (0x8c60) and the descending record stride. The
  // scan walks the table for the first free slot and, if it finds one, seeds a fresh
  // formation object there (which also reloads this countdown for the next launch).
  // countdown expired: scan the formation record table for a free slot
  return scanFormationSlotsAndLaunchFree(m, FORMATION_SPAWN_TABLE, RECORD_STRIDE);
}
