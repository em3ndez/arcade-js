// SPDX-License-Identifier: GPL-3.0-only
import { tickColumnCountdown } from "./tickColumnCountdown.js";
import { negateA } from "./negateA.js";
import { steerObjectRowTarget } from "./steerObjectRowTarget.js";
import {
  loc_43, loc_41, loc_00, loc_f2, loc_a1, loc_51, OBJECT_X_DRIFT_STASH, loc_61,
  OBJECT_Y_STEER, loc_8b, loc_71, loc_ef, POKEY_RANDOM, CONFIG_DIP_BYTE,
} from "./names.js";

/**
 * advanceColumnHeadingState — per-frame step of a column's heading/dwell state, then hand off to the
 * row-target steerer.
 *
 * Gated on the state flag. In the high-heading branch it bails unless the heading has reached the far
 * edge, then re-arms the tick countdown. In the low-heading branch it steps the heading every fourth
 * frame (wrapping past a fold boundary), ticks the dwell timer, and on wrap conditionally swaps the
 * column delta in/out of a stash, negates the drift cell, and re-arms the timer. Finally it folds the
 * delta out of the row cell, mirrors it, and tail-transfers into the steerer with the summed heading. [code]
 */
export function advanceColumnHeadingState(m) {
  const { mem8 } = m;

  // Gate: only advance while none of the state-flag's selector bits are set.
  if ((mem8[loc_43] & 0xaf) !== 0) return;

  const heading = mem8[loc_41];
  if ((heading & 0x20) !== 0) {
    // High-heading branch: bail until the heading reaches the far edge, then re-arm the tick.
    if (heading < 0xf8) return;
    return tickColumnCountdown(m);
  }

  // Low-heading branch: every fourth frame, step and fold the heading.
  if ((mem8[loc_00] & 0x03) === 0) {
    const stepped = (mem8[loc_41] + 1) & 0xff;
    mem8[loc_41] = stepped;
    if ((stepped ^ mem8[loc_f2]) >= 0x1c) mem8[loc_41] = 0x14 ^ mem8[loc_f2];
  }

  // Tick the dwell timer; on wrap-through-zero, retarget the column and re-arm.
  const dwell = (mem8[loc_a1] - 1) & 0xff;
  mem8[loc_a1] = dwell;
  if (dwell === 0) {
    if ((mem8[POKEY_RANDOM] & 0x80) !== 0) {
      const delta = mem8[loc_51];
      if (delta === 0) {
        mem8[loc_51] = mem8[OBJECT_X_DRIFT_STASH]; // resume: restore the stashed delta
      } else if (mem8[loc_61] >= 0x05 && mem8[loc_61] < 0xfb) {
        mem8[OBJECT_X_DRIFT_STASH] = delta; // pause: stash the delta and zero it
        mem8[loc_51] = 0x00;
      }
    }
    // Conditionally negate the drift cell.
    if (((((mem8[CONFIG_DIP_BYTE] & 0x40) | 0x20) & mem8[POKEY_RANDOM])) !== 0) {
      mem8[OBJECT_Y_STEER] = negateA(m, mem8[OBJECT_Y_STEER]);
    }
    mem8[loc_a1] = 0x30;
  }

  // Fold the delta out of the row cell, mirror it, then steer with the summed heading.
  const row = (mem8[loc_61] - mem8[loc_51]) & 0xff;
  mem8[loc_61] = row;
  mem8[loc_8b] = row;
  let heading2 = mem8[loc_71];
  if (mem8[loc_ef] === 0) heading2 = (heading2 - mem8[OBJECT_Y_STEER]) & 0xff;
  else heading2 = (heading2 + mem8[OBJECT_Y_STEER]) & 0xff;
  return steerObjectRowTarget(m, heading2);
}
