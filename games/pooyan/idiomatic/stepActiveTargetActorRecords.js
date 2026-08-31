// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { advanceTargetActorState } from "./advanceTargetActorState.js";
import { advanceActorAnimationsUnlessGrabbing } from "./advanceActorAnimationsUnlessGrabbing.js";
import {
  ENEMY_TARGET_REC0,
  TARGET_SCAN_COUNTER,
  ANIM_SCRIPT_CURSOR,
  TARGET_SPAWN_ARM_LATCH,
} from "./names.js";
/**
 * stepActiveTargetActorRecords -- WHAT IT IS: the per-frame stepper for the two
 * "target actor" records, the player-launched target actors that ride the field. It
 * walks both records in the 0x18-stride actor-record array based at ENEMY_TARGET_REC0
 * (0x8c90), advancing each record that is currently occupied, then closes with an
 * integrity check on the shared animation-script cursor.
 *
 * ROLE IN THE MACHINE: this is the FIRST of the four per-frame passes that
 * advanceObjectsAndRebuildSprites runs while the in-play sub-states are active (the
 * target-actor step, then the per-object state sweep, formation-state dispatch, and the
 * sprite display-list rebuild). It is what keeps the launched targets moving, timing
 * down, and tearing themselves down frame to frame.
 *
 * ROM: 0x2157-0x2183.
 * Grounding: [seen].
 *
 * The visit count is NOT carried in a register across the per-object step. It is parked
 * in the memory cell TARGET_SCAN_COUNTER (0x8f15) before each record is stepped and
 * reloaded afterward, so it survives even though advanceTargetActorState can overwrite
 * every register while it moves, times, or tears down its record.
 *
 * Once both records are stepped, an anti-tamper check reads the low byte of
 * ANIM_SCRIPT_CURSOR (0x8f00) and compares it against the constant 0xd5 (= TAMPER_BIAS
 * 0x0c + TAMPER_REF 0xc9, the Z80 RET opcode value this game's integrity lattice uses as
 * a reference byte). At the expected 0xd5 the pass clears TARGET_SPAWN_ARM_LATCH (0x8f02)
 * to re-arm the one-shot spawn gate and returns; any other value diverts the frame into
 * advanceActorAnimationsUnlessGrabbing, the animation-script stepper for the four actor
 * records -- a tamper tripwire folded into this pass.
 *
 * LIVE-OUT: on the match path, TARGET_SPAWN_ARM_LATCH (0x8f02) = 0 and nothing is
 * returned (callers read the actor records and latches back out of memory); on the
 * mismatch path, the pass forwards whatever advanceActorAnimationsUnlessGrabbing leaves.
 */

const STRIDE = 0x18; // target-record stride: the two records sit 0x18 bytes apart in the 0x8c90 array
const TAMPER_BIAS = 0x0c; // bias subtracted from the cursor first; with TAMPER_REF it forms the 0xd5 target
const TAMPER_REF = 0xc9; // reference byte: the Z80 RET opcode value the integrity lattice checks against

export function stepActiveTargetActorRecords(m) {
  const { mem8 } = m;

  // --- Pass over the two target-actor records -------------------------------------------
  // Begin at ENEMY_TARGET_REC0 (0x8c90) with a count of 2. For each record: park the
  // remaining count in TARGET_SCAN_COUNTER (0x8f15), step the record only when it is
  // occupied, walk to the next record one STRIDE (0x18) on, then reload and decrement.
  let rec = ENEMY_TARGET_REC0; // first target-actor record (0x8c90)
  let count = 0x02; // exactly two records to visit
  do {
    // Hold the live count in memory (0x8f15): the per-object step below can clobber every
    // register, so the loop counter lives in a cell, not in a register.
    mem8[TARGET_SCAN_COUNTER] = count;
    // Presence gate: bit0 of the record's first byte marks the slot occupied. Only an
    // occupied record is advanced -- moved, hit-timed, or torn down -- by the state step.
    if (mem8[rec] & 0x01) advanceTargetActorState(m, rec); // presence bit0 set -> step this object
    rec = u16(rec + STRIDE); // advance to the next record, 0x18 bytes on
    // Reload the count (it outlived the step) and count one record down; loop until zero.
    count = u8(mem8[TARGET_SCAN_COUNTER] - 1);
  } while (count !== 0);

  // --- Integrity check on the animation-script cursor -----------------------------------
  // Read the low byte of ANIM_SCRIPT_CURSOR (0x8f00) and subtract TAMPER_BIAS (0x0c) then
  // TAMPER_REF (0xc9): the result is zero only when the cursor holds 0xd5, the value it is
  // expected to sit at here each frame. Anything else diverts the frame into
  // advanceActorAnimationsUnlessGrabbing (the animation-script stepper for the four actor
  // records) instead of clearing the spawn latch -- the tamper tripwire folded into this pass.
  if (u8(mem8[ANIM_SCRIPT_CURSOR] - TAMPER_BIAS - TAMPER_REF) !== 0) return advanceActorAnimationsUnlessGrabbing(m);
  // Cursor matched: re-arm the one-shot spawn gate by clearing TARGET_SPAWN_ARM_LATCH
  // (0x8f02) so the next launch trigger can spawn a target actor once more, then return.
  mem8[TARGET_SPAWN_ARM_LATCH] = 0;
}
