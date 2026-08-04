// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_33e7 — advance an object's sprite animation, then nudge its step counter up or
 * down according to the object's state.  ROM 0x33E7.
 *
 * Handles one record of an object array (the record base is the caller's live-in
 * object pointer). It first runs the object's sprite-animation step, then adjusts a
 * per-object step counter (record byte +0x0F) based on the object's state byte
 * (+0x0D):
 *
 *   - State other than 8: step the counter UP by one and stop.
 *   - State 8: a per-object sub-timer (record byte +0x14) paces the counter DOWN at
 *     half rate. While the sub-timer is still running it is only ticked down. When it
 *     reaches 0 it is reloaded to 2 and the step counter is stepped DOWN by one — so
 *     in state 8 the counter falls once every other call.
 *
 * The sprite-animation step runs FIRST, before any of the state/counter fields are
 * read, so its own writes to this record (the animation timer and sprite-tile bytes)
 * land before this routine touches the record.
 *
 * Memory-equivalent to the frozen oracle — equivalence-33e7.test.js.
 * GATE:     captured + crafted. 0x33E7 is reached in attract through the translated closure
 *           chain (entry_30ed -> entry_31b1 -> entry_3202), so real captured dispatches are
 *           replayed against the oracle; a crafted grid over the state / sub-timer / counter
 *           fields and the callee's two input bytes (on a real attract-base object record) then
 *           broadens coverage to the non-8 up arm, both state-8 down arms, and both counter
 *           wraps. Teeth: a counter-up-instead-of-down twin, a wrong sub-timer reload twin, and
 *           an inverted state-gate twin.
 * LIVE-OUT: memory-only. The caller reloads the accumulator on the instruction right after
 *           the call, so the oracle's residual registers/flags and its terminal return are
 *           dead ABI; the direct call to the animation stepper dissolves the oracle's
 *           push/return bracket around it (the dead push lands in STACK_SCRATCH, excluded).
 * NAMES:    stepObjectSpriteFrame (ROM 0x3409) — direct-called with the live-in object
 *           pointer as its base argument. The three record fields this routine touches
 *           (+0x0D state, +0x0F step counter, +0x14 sub-timer) are object-relative offsets
 *           with no names.js cell name; kept as local field-offset consts.
 */

import { stepObjectSpriteFrame } from "./stepObjectSpriteFrame.js"; // ROM 0x3409
import { OBJ_STATE } from "./names.js"; // record field +0x0D — object state selector (named cell)

// Object-record field offsets (into the record the caller hands us in the object pointer).
const OBJ_STEP_COUNTER = 0x0f; // the per-object step counter this routine nudges up/down
const OBJ_SUB_TIMER = 0x14;    // period-2 sub-timer that paces the state-8 down-step

export function loc_33e7(m) {
  const { mem, regs } = m;

  // The caller passes the object-record base in its object pointer (still an oracle-boundary
  // register ABI — entry_3202 m.call's this routine with that pointer set).
  const objBase = regs.ix;

  // Advance the object's sprite animation FIRST, before any field below is read.
  stepObjectSpriteFrame(m, objBase);

  const stateAddr = (objBase + OBJ_STATE) & 0xffff;
  const counterAddr = (objBase + OBJ_STEP_COUNTER) & 0xffff;
  const subTimerAddr = (objBase + OBJ_SUB_TIMER) & 0xffff;

  // State other than 8: step the counter up and stop.
  if (mem.read8(stateAddr) !== 0x08) {
    mem.write8(counterAddr, mem.read8(counterAddr) + 1);
    return;
  }

  // State 8: the sub-timer paces the counter down at half rate.
  const subTimer = mem.read8(subTimerAddr);
  if (subTimer !== 0) {
    // Still running: just tick the sub-timer down this call.
    mem.write8(subTimerAddr, subTimer - 1);
    return;
  }

  // Sub-timer expired: reload it to 2 and step the counter down.
  mem.write8(subTimerAddr, 0x02);
  mem.write8(counterAddr, mem.read8(counterAddr) - 1);
}
