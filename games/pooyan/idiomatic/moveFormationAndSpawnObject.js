// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { advanceObjectColumnByStepAndDispatch } from "./advanceObjectColumnByStepAndDispatch.js";
import { advanceActorColumnAndArmTurnOrBand } from "./advanceActorColumnAndArmTurnOrBand.js";
import { blankActorSpriteBand } from "./blankActorSpriteBand.js";
import { clearColumnLimitAndArmTurnAnimation } from "./clearColumnLimitAndArmTurnAnimation.js";
import { latchColumnLimitAndArmTurnAnimation } from "./latchColumnLimitAndArmTurnAnimation.js";
import { initDescendingObjectSlot } from "./initDescendingObjectSlot.js";
import {
  STAGE_COUNTDOWN,
  SPAWN_SWEEP_TRIGGER,
  SPAWN_SWEEP_COUNTDOWN,
  SPAWN_SPEED_INDEX,
  SPAWN_SPEED_VALUE,
  ENEMY_ACTOR_TABLE,
  SPAWN_OBJECT_TABLE,
  SIGNATURE_CHECK_SRC,
  SIGNATURE_CHECK_TABLE,
  TAMPER_STRIKES_OBJSIG,
} from "./names.js";
/**
 * moveFormationAndSpawnObject — the per-frame update body for one moving object.
 *
 * ROM 0x4221-0x42d9.  Grounding: [seen].
 *
 * WHAT IT IS.  Every moving thing on the playfield — an enemy walking its column, a
 * descending object drifting down toward the player — lives in a small fixed-layout
 * record, and each frame its owning record is handed to a state handler that advances it
 * one tick.  This is that state handler for a whole class of those objects.  The record to
 * act on arrives as `ix`; the two record fields this routine steers on are:
 *   - (ix+0x08) bit0  — the movement-mode flag: set = the object is stepping DOWN its tile
 *                       column, clear = the object is moving ACROSS in X.
 *   - (ix+0x06)&0x1f  — the object's progress phase, a 0..31 counter the movement helpers
 *                       bump as the object travels; it is the clock that decides when the
 *                       object has gone far enough to turn or to hand off.
 *
 * ROLE IN THE MACHINE.  Called once per frame per live record.  It first ticks the object's
 * own animation program, then — depending on which way the object is moving — walks it one
 * step, and once the object has travelled past a per-direction threshold it either flips its
 * movement mode and arms a turn-around animation, or falls through into the shared
 * bookkeeping tail (`blockP`).  That tail is the game's spawn-cadence gate: on the right
 * frames it runs the descending-object spawn sweep (`blockC9`), which drops a fresh object
 * into the playfield.  Early in a stage the down-moving branch instead detours through an
 * anti-tamper program-signature check.
 *
 * LIVE-OUT: memory only.  The object record is advanced in place; the spawn-cadence cells
 * and, on a spawn frame, the newly seeded object record are written; on a tamper miss the
 * strike tally is bumped.  No register/value result — one seeded slot inside `blockC9`
 * unwinds the sweep one level up.
 */
export function moveFormationAndSpawnObject(m, ix = m.regs.ix) {
  const { mem8 } = m;

  // -- blockC9 (ROM 0x42c9): the descending-object spawn sweep ----------------------------------
  // Walk the three-slot spawn-object table (SPAWN_OBJECT_TABLE 0x8c48, records 0x18 apart) and
  // offer each record to the slot initializer in turn.  An occupied record is passed over; the
  // first EMPTY record is seeded into a live falling object, and the initializer answers false to
  // say "I claimed a slot" — which stops the sweep right there.  So at most one object is born per
  // pass: the moment a slot is populated the whole sweep unwinds and the frame moves on.
  const blockC9 = () => { // clear 3 stride-0x18 slots of the spawn-object table
    let slot = SPAWN_OBJECT_TABLE;
    let b = 0x03;
    do {
      if (!initDescendingObjectSlot(m, slot, ix)) return; // slot initialized -> caller-skip aborts the sweep
      slot = u16(slot + 0x18);
      b = (b - 1) & 0xff;
    } while (b !== 0);
  };

  // -- blockP (ROM 0x4290): the shared bookkeeping tail / spawn-cadence gate ---------------------
  // Reached once a moving object has advanced but not yet hit its turn threshold.  It decides,
  // frame by frame, whether it is time to spawn the next descending object.  `phase` is the same
  // (ix+0x06)&0x1f progress counter from the caller.
  const blockP = (phase) => { // shared bookkeeping tail (phase = (ix+6)&0x1f)
    // Nothing spawns until the object is at least a little way into its run (phase >= 5).
    if (phase < 0x05) return;
    // If the sweep trigger (SPAWN_SWEEP_TRIGGER 0x8d5b) is already armed, run the sweep now.
    if (mem8[SPAWN_SWEEP_TRIGGER] !== 0) return blockC9();
    // Otherwise we are between spawns: SPAWN_SWEEP_COUNTDOWN (0x8d5a) counts down the inter-spawn
    // delay one tick per eligible frame, and we wait until it reaches zero.
    if (mem8[SPAWN_SWEEP_COUNTDOWN] !== 0) {
      mem8[SPAWN_SWEEP_COUNTDOWN] = mem8[SPAWN_SWEEP_COUNTDOWN] - 1;
      return;
    }
    // The delay has elapsed.  Mid-stage (STAGE_COUNTDOWN 0x8901 still >= 8) we additionally hold
    // the spawn back until at least one enemy actor has settled: scan the enemy actor table
    // (ENEMY_ACTOR_TABLE 0x8ae0, records 0x18 apart) across SPAWN_SPEED_INDEX (0x8d5c) slots for a
    // record whose (iy+0x04) field reads 7 (the settled marker).  With none settled, wait a frame.
    if (mem8[STAGE_COUNTDOWN] >= 0x08) { // scan the actor table for a settled slot ((iy+4)==7)
      let iy = ENEMY_ACTOR_TABLE;
      let n = mem8[SPAWN_SPEED_INDEX];
      let found = false;
      do {
        if (mem8[iy + 0x04] === 0x07) { found = true; break; }
        iy = u16(iy + 0x18);
        n = (n - 1) & 0xff;
      } while (n !== 0);
      if (!found) return;
    }
    // Cleared to spawn: reload both cadence cells from the round-scaled spawn speed value
    // (SPAWN_SPEED_VALUE 0x8d5d) — this both arms the trigger and sets the next inter-spawn delay —
    // then run the sweep to birth the object.
    const v = mem8[SPAWN_SPEED_VALUE]; // seed the sweep pair, then clear the table
    mem8[SPAWN_SWEEP_COUNTDOWN] = v;
    mem8[SPAWN_SWEEP_TRIGGER] = v;
    return blockC9();
  };

  // Step 1 (ROM 0x4221 call 0x4006): advance this object's animation program by one frame — hold
  // the current tile while its frame counter runs, else load the next {tile,attr,hold} from its
  // script.  Runs for every object regardless of which way it is moving.
  advanceObjectAnimationFrame(m, ix);

  // Step 2: branch on the movement-mode flag (ix+0x08) bit0.
  if ((mem8[ix + 0x08] & 0x01) !== 0) { // bit0 set
    // DOWN-THE-COLUMN branch.  Step the object one place down its tile column and dispatch its
    // per-position sub-state (ROM 0x34f2).
    advanceObjectColumnByStepAndDispatch(m, ix);
    const phase = mem8[ix + 0x06] & 0x1f;
    // Past the down-branch turn threshold (0x0a) the object hands off to the spawn-cadence tail.
    if (phase >= 0x0a) return blockP(phase);
    // Very early in a stage (STAGE_COUNTDOWN 0x8901 < 2), and only for the first couple of phases,
    // this slot instead performs a program-signature integrity check before it may arm a turn.
    if (mem8[STAGE_COUNTDOWN] < 0x02) { // signature-check branch
      if (phase >= 0x02) return;
      blankActorSpriteBand(m, ix); // blank the sprite band
      // Anti-tamper check: sum a run of the program image read DESCENDING from SIGNATURE_CHECK_SRC
      // (0x0bb9) against a two's-complement reference table read ASCENDING from SIGNATURE_CHECK_TABLE
      // (0x4283).  For an intact ROM every byte-pair cancels to 0; the loop ends at the table's 0xff
      // terminator.  Any pair that fails to cancel is tampering.
      let src = SIGNATURE_CHECK_SRC; // program-image run summed descending vs the two's-complement table
      let tbl = SIGNATURE_CHECK_TABLE;
      for (;;) {
        if (((mem8[src] + mem8[tbl]) & 0xff) !== 0) { // mismatch -> bump the strike tally
          // A mismatched pair bumps the object-signature strike tally (TAMPER_STRIKES_OBJSIG 0x8a3a)
          // and abandons the check for this frame.
          mem8[TAMPER_STRIKES_OBJSIG] = mem8[TAMPER_STRIKES_OBJSIG] + 1;
          return;
        }
        src = u16(src - 1);
        tbl = u16(tbl + 1);
        if (((mem8[tbl] + 1) & 0xff) === 0) return; // 0xff terminator
      }
    }
    // Turn threshold reached: flip the object to the X-moving mode for next frame ((ix+0x08)=0) and
    // arm the turn-around animation, latching the turn-column limit (TURN_COLUMN_LIMIT 0x8d4b) to
    // 0xff so the interior-entry animation runs.
    mem8[ix + 0x08] = 0x00; // interior-entry arm
    return latchColumnLimitAndArmTurnAnimation(m, ix);
  }

  // ACROSS-IN-X branch (ix+0x08 bit0 clear).  Step the object along its column and, if it has
  // reached its band, arm the turn/band setup (ROM 0x343e).
  advanceActorColumnAndArmTurnOrBand(m, ix); // bit0 clear -> X-movement
  const phase = mem8[ix + 0x06] & 0x1f;
  // Below the X-branch turn threshold (0x14) the object hands off to the spawn-cadence tail.
  if (phase < 0x14) return blockP(phase);
  // Threshold reached: flip the object to the down-the-column mode for next frame ((ix+0x08)=1) and
  // arm the turn-around animation, clearing the turn-column limit (TURN_COLUMN_LIMIT 0x8d4b) to 0.
  mem8[ix + 0x08] = 0x01; // interior-entry arm
  return clearColumnLimitAndArmTurnAnimation(m, ix);
}
