// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_33e7 — advance an object's sprite animation, then nudge its per-object step counter up or
 * down according to the object's state. The record base arrives in the index register.
 *
 * LIVE-OUT: memory-only.
 */

import { u16 } from "../../../core/int.js";
import { stepObjectSpriteFrame } from "./stepObjectSpriteFrame.js";
import { OBJ_STATE } from "./names.js";

const OBJ_STEP_COUNTER = 0x0f;
const OBJ_SUB_TIMER = 0x14;

export function loc_33e7(m, ix = m.regs.ix) {
  const { mem8 } = m;

  const objBase = ix;

  // Animation runs first, before any state/counter field below is read.
  stepObjectSpriteFrame(m, objBase);

  const stateAddr = u16(objBase + OBJ_STATE);
  const counterAddr = u16(objBase + OBJ_STEP_COUNTER);
  const subTimerAddr = u16(objBase + OBJ_SUB_TIMER);

  // State other than 8: step the counter up and stop.
  if (mem8[stateAddr] !== 0x08) {
    mem8[counterAddr] = mem8[counterAddr] + 1;
    return;
  }

  // State 8: the sub-timer paces the counter down at half rate.
  const subTimer = mem8[subTimerAddr];
  if (subTimer !== 0) {
    mem8[subTimerAddr] = subTimer - 1;
    return;
  }

  mem8[subTimerAddr] = 0x02;
  mem8[counterAddr] = mem8[counterAddr] - 1;
}
