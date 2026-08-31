// SPDX-License-Identifier: GPL-3.0-only
import { setActorAnimation } from "./setActorAnimation.js";
import { WAVE_ARRIVAL_COUNTER, FORMATION_SPAWN_TIMER, ANIM_SEQ_2D5D } from "./names.js";
/**
 * loc_2be5 — the formation-slot launcher: try to bring ONE formation object to life.
 *
 * WHAT IT IS
 *   The per-slot initializer for the formation-spawn scan. Its caller,
 *   scanFormationSlotsAndLaunchFree (ROM 0x2bb3), walks the formation spawn record table
 *   (FORMATION_SPAWN_TABLE, 0x8c60) — 0x11 records, 0x18 bytes apart, stepping
 *   downward — and hands each record here in turn. This routine inspects the one record it
 *   is given and decides whether that slot is available: a busy slot is left untouched and
 *   the scan is told to keep looking; the first free slot is seeded with a brand-new
 *   formation object and the scan is told to stop. The net effect across one sweep is
 *   "launch at most one new object per pass into the first empty slot".
 *
 * ROLE IN THE MACHINE
 *   Formation objects are the enemies/birds that arrive in the play field wave after wave.
 *   A separate countdown (FORMATION_SPAWN_TIMER) governs the pacing between launches; when
 *   that timer expires the scan runs and this routine claims a slot, re-arms the countdown,
 *   and burns one arrival off the per-stage wave counter. So this is the moment a single
 *   formation slot flips from empty to a fully-armed, animating object.
 *
 * ROM ADDRESS: 0x2be5–0x2c2b.
 *
 * GROUNDING: [seen] throughout — this launcher belongs to the [seen] formation-spawn scan
 *   (scanFormationSlotsAndLaunchFree, 0x2bb3) and every cell it touches is [seen]: the
 *   record table FORMATION_SPAWN_TABLE (0x8c60), the wave counter WAVE_ARRIVAL_COUNTER
 *   (0x8903), the spawn countdown FORMATION_SPAWN_TIMER (0x8d30), and the animation
 *   sequence ANIM_SEQ_2D5D armed through setActorAnimation (0x381e, also [seen]).
 *
 * LIVE-OUT (memory only — the caller reads back no register):
 *   • On a busy slot: nothing is written.
 *   • On a launch: rec+0..rec+7 and rec+9 are seeded, WAVE_ARRIVAL_COUNTER (0x8903) is
 *     decremented by one, the record's animation is armed, and FORMATION_SPAWN_TIMER
 *     (0x8d30) is reloaded with the next inter-launch delay.
 *
 * CALLER-SKIP SIGNAL: the boolean return steers the caller's record scan.
 *   true  = the slot is busy — keep scanning the remaining records.
 *   false = the slot got a launch — abort the scan (one launch per sweep).
 */

const BUSY = 0x01; // bit0 of the activity word marks a slot in use
const SPAWN_TIMER_BASE = 0x20; // per-wave countdown = base - min(wave, cap)
const WAVE_CAP = 0x0a; // wave clamp before the countdown subtraction

export function loc_2be5(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Availability test. A record's activity/state lives in the first two bytes, and a slot
  // counts as occupied whenever bit0 is set in EITHER of them — so OR the two together and
  // test the BUSY bit. Occupied → write nothing and report "keep scanning" so the caller
  // moves on to the next record in the table.
  if (((mem8[rec + 0x00] | mem8[rec + 0x01]) & BUSY) !== 0) return true; // busy -> keep scanning

  // Slot is free: seed a fresh formation object into it.
  //
  // Claim the slot and lay down its fixed initial fields. rec+0 sets the same BUSY bit the
  // guard tested, so this record reads as occupied on the following sweep. rec+2..rec+6
  // are the object's starting state/kind and coordinate/sub-position bytes (two of them
  // cleared to zero, two given fixed launch constants).
  mem8[rec + 0x00] = 0x01;
  mem8[rec + 0x02] = 0x11;
  mem8[rec + 0x03] = 0x00;
  mem8[rec + 0x05] = 0x00;
  mem8[rec + 0x04] = 0x1c;
  mem8[rec + 0x06] = 0x03;

  // Consume one arrival from the per-stage wave counter (WAVE_ARRIVAL_COUNTER, 0x8903).
  // Each launched formation object spends one arrival, so this counts the wave down as
  // objects enter the field. The decremented value drives the two derived quantities below.
  const wave = (mem8[WAVE_ARRIVAL_COUNTER] - 1) & 0xff; // consume one wave arrival
  mem8[WAVE_ARRIVAL_COUNTER] = wave;

  // rec+7 gets the low bit (parity) of the remaining arrival count. Alternating this flag
  // every launch lets the spawn logic pick between two variants / entry sides as the wave
  // drains.
  mem8[rec + 0x07] = wave & 0x01; // parity of the remaining count

  // Arm the object's animation. setActorAnimation (0x381e) points the record at the
  // animation sequence ANIM_SEQ_2D5D and restarts it from the top, so the freshly-launched
  // object begins cycling frames immediately.
  setActorAnimation(m, rec, ANIM_SEQ_2D5D);

  // Reload the inter-launch countdown (FORMATION_SPAWN_TIMER, 0x8d30) that paces the next
  // spawn. The delay is base - clamp(wave, cap): the remaining-arrival count is capped at
  // WAVE_CAP (0x0a) before subtracting from SPAWN_TIMER_BASE (0x20), so the interval floors
  // at 0x16 and the more arrivals still owed, the shorter the wait — later in a wave the
  // objects pour in faster.
  const clamped = wave < WAVE_CAP ? wave : WAVE_CAP;
  mem8[FORMATION_SPAWN_TIMER] = SPAWN_TIMER_BASE - clamped;

  // Frame-delay / anim-hold seed for the new object (the standard 0x10 hold used across the
  // level-start seeds). Its state machine will count this down before its first advance.
  mem8[rec + 0x09] = 0x10;

  // Launched exactly one object → report "abort" so the caller stops scanning this sweep.
  return false; // slot launched -> abort the caller's scan
}
