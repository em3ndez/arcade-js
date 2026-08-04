// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_33e7 — advance an object's sprite animation, then nudge its step counter up or
 * down according to the object's state.
 *
 * Handles one record of an object array; the record base arrives in the index
 * register. It first advances the object's sprite animation, then adjusts a
 * per-object step counter (record byte +0x0F) based on the object's state byte
 * (+0x0D):
 *
 *   - State other than 8: step the counter UP by one and stop.
 *   - State 8: a per-object sub-timer (record byte +0x14) paces the counter DOWN at
 *     half rate. While the sub-timer is still running it is only ticked down. When it
 *     reaches 0 it is reloaded to 2 and the step counter is stepped DOWN by one — so
 *     in state 8 the counter falls once every other call.
 *
 * The animation step runs FIRST, before any of the state/counter fields are read, so
 * its own writes to this record (the animation timer and sprite-tile bytes) land
 * before this routine touches the record.
 *
 * LIVE-OUT: memory-only.
 */

import { stepObjectSpriteFrame } from "./stepObjectSpriteFrame.js";
import { OBJ_STATE } from "./names.js"; // record field +0x0D — the object's state selector

// Object-record field offsets (into the record the caller hands us in the object pointer).
const OBJ_STEP_COUNTER = 0x0f; // the per-object step counter this routine nudges up/down
const OBJ_SUB_TIMER = 0x14;    // period-2 sub-timer that paces the state-8 down-step

export function loc_33e7(m) {
  const { mem, regs } = m;

  // The caller leaves the object-record base in the index register.
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
