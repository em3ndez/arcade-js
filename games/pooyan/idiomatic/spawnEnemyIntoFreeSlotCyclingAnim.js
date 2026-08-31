// SPDX-License-Identifier: GPL-3.0-only
import { setActorAnimation } from "./setActorAnimation.js";
import {
  BLINK_COUNTDOWN,
  ANIM_PHASE_TOGGLE_892C,
  ANIM_PARAM_76D4,
  ANIM_PARAM_68EF,
  ANIM_PARAM_6B0A,
} from "./names.js";

// ---------------------------------------------------------------------------
// The literal bytes this spawn tests and seeds, named so each write below reads
// as intent rather than a magic number.
// ---------------------------------------------------------------------------
const ACTIVE_BIT = 0x01; // an enemy record counts as live when bit 0 of EITHER of its two
// header bytes is set; the sweep tests (rec+0 | rec+1) & this to find a free slot
const SPAWN_DELAY = 0x10; // frames written into the blink/spawn-cadence countdown (0x892a)
// on every spawn — the gap the driver waits before it is allowed to spawn again
const PHASE1_DELAY = 0x1c; // longer cadence value the same countdown is reloaded with when the
// pre-bump spawn phase happens to be exactly 1 (a slower beat for that phase)
const PHASE_MID = 0x02; // pre-bump spawn-phase value that selects the middle animation block

/**
 * spawnEnemyIntoFreeSlotCyclingAnim — spawn and initialise one enemy actor into a single record slot.
 *
 * ROM address: 0x6a35 (0x6a35-0x6a7e). Grounding: [seen] — this is the per-record body of the
 * enemy-spawn sweep spawnEnemyOnBlinkCountdownSweep (0x6a0f) [seen], and every cell and
 * animation block it touches carries a [seen] cert in names.js.
 *
 * WHAT IT IS / ROLE IN THE MACHINE:
 * The enemy-spawn driver at 0x6a0f gates on the blink phase and countdown, then walks the pool of
 * 18 enemy-actor records (based at 0x8ae0, one record every 0x18 bytes) and hands each record to
 * this routine in turn. This routine decides, for the one record it is given, whether that slot is
 * free and — if so — brings a new enemy to life in it. Exactly ONE enemy is meant to appear per
 * eligible frame, and the return value is what enforces that:
 *
 *   - A record that is ALREADY live is left untouched and reported with `true`, which tells the
 *     driver "nothing happened here, keep scanning" so it moves on to the next slot.
 *   - The FIRST empty record is spawned into, and the routine reports `false`. In the ROM this
 *     path returns one level higher than an ordinary return, unwinding past the driver's scan
 *     loop so the sweep stops after this single spawn; the `false` result carries that "abort the
 *     sweep" outcome outward.
 *
 * When it spawns, it activates the record, seeds its state / position / facing fields, arms the
 * spawn-cadence countdown, then advances a rotating spawn-phase counter and uses that counter to
 * choose which of three animation blocks the new enemy plays — so consecutive enemies cycle
 * through different entrance animations.
 *
 * LIVE-OUT: no register value is meant to survive — the driver keeps its own loop counter and
 * record pointer. Memory: the newly seeded record fields, the record's animation cells (written
 * by setActorAnimation), the spawn-cadence countdown at 0x892a, and the advanced phase counter at
 * 0x892c. Plus the boolean signal (true = keep sweeping, false = spawned, abort the sweep).
 */
export function spawnEnemyIntoFreeSlotCyclingAnim(m, ix = m.regs.ix) {
  const { mem8 } = m;

  // --- Free-slot test ------------------------------------------------------
  // The record's two header bytes (ix+0, ix+1) hold its active flags. If bit 0 of either is set
  // the slot already holds a live enemy, so there is nothing to do here: report `true` and let
  // the driver advance to the next record in the pool.
  if (((mem8[ix] | mem8[ix + 1]) & ACTIVE_BIT) !== 0) return true; // already active -> keep sweeping

  // --- Bring the record to life -------------------------------------------
  // The slot is empty. Seed the freshly activated enemy record's fields to their spawn defaults.
  mem8[ix + 3] = 0x00; // clear the sub-position / low bytes carried over from a prior tenant
  mem8[ix + 5] = 0x00;
  mem8[ix + 1] = 0x01; // set the active marker (ix+1), which the free-slot test above reads back
  mem8[ix + 2] = 0x01; // state byte -> 1: the first live state the per-frame dispatcher will run
  mem8[ix + 4] = 0x15; // starting Y coordinate (record layout puts the vertical position at +4)
  mem8[ix + 6] = 0x1e; // companion position/coordinate seed
  mem8[ix + 9] = 0x28; // facing / variant field
  mem8[BLINK_COUNTDOWN] = SPAWN_DELAY; // arm the spawn-cadence countdown (0x892a) so the driver
  // holds off before the next spawn

  // --- Pick the entrance animation by the rotating spawn phase -------------
  // 0x892c is a small counter that advances on every spawn. Read it BEFORE bumping it: that
  // pre-bump value is this enemy's spawn phase, and it selects which animation block plays.
  // Bumping it afterwards means the next enemy gets the next phase, so entrances rotate.
  const phase = mem8[ANIM_PHASE_TOGGLE_892C];
  mem8[ANIM_PHASE_TOGGLE_892C] = phase + 1; // advance the spawn-phase counter for the next enemy

  let animPointer;
  if (phase === PHASE_MID) {
    // phase 2: the middle animation block.
    animPointer = ANIM_PARAM_68EF;
  } else if (phase > PHASE_MID) {
    // phase 3 and beyond: the late animation block.
    animPointer = ANIM_PARAM_6B0A;
  } else {
    // phase 0 or 1: the early animation block. Phase 1 additionally slows the cadence, replacing
    // the SPAWN_DELAY just written with the longer PHASE1_DELAY in the same countdown (0x892a).
    if (phase !== 0) mem8[BLINK_COUNTDOWN] = PHASE1_DELAY; // phase 1 re-arms the countdown longer
    animPointer = ANIM_PARAM_76D4;
  }
  // Point the new enemy record at the chosen animation block and restart its animation.
  setActorAnimation(m, ix, animPointer);
  // Report the spawn: the driver stops sweeping, so only this one enemy appears this frame.
  return false; // spawned -> caller aborts the sweep
}
