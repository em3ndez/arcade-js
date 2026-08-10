// SPDX-License-Identifier: GPL-3.0-only
/** destroyFixedTargetHitByShots — run one fixed target against the six-slot shot array and destroy the shots that
 * reached it. The target's state byte must read live before the sweep (tested once, ahead of the loop); each live
 * slot is then tested on both axes as a wrapped window around the target, and a slot inside both is marked destroyed
 * with the target and its score posted. The sweep runs on through the remaining slots, so every overlapping shot is
 * spent and scores in the one call. Slot addressing steps only the low half of the cursor, so a wide enough array
 * would wrap inside its page. LIVE-OUT: memory only. */

import { postChainedHitScore } from "./postChainedHitScore.js";
import { u8 } from "../../../core/int.js";
import { PLAYER_SHOT_ARRAY } from "./names.js";

const SLOTS = 6;
const SLOT_STRIDE = 0x10;

const OCCUPANCY = 0;
const SHOT_FIRST_AXIS = 6;
const SHOT_SECOND_AXIS = 4;

const TARGET_FIRST_AXIS = 0xaa28;
const TARGET_SECOND_AXIS = 0xaa59;
const FIRST_AXIS_SLACK = 6;
const FIRST_AXIS_WINDOW = 0x0d;
const SECOND_AXIS_SLACK = 0x17;
const SECOND_AXIS_WINDOW = 0x1f;

const TARGET_STATE = 0xa8c0;
const LIVE = 0xff;
const DESTROYED = 0xf0;

export function destroyFixedTargetHitByShots(m) {
  const { mem8 } = m;
  if (mem8[TARGET_STATE] !== LIVE) return;

  let slot = PLAYER_SHOT_ARRAY;
  for (let i = 0; i < SLOTS; i++) {
    if (mem8[slot + OCCUPANCY] === LIVE) {
      const across = u8(mem8[TARGET_FIRST_AXIS] - mem8[slot + SHOT_FIRST_AXIS] + FIRST_AXIS_SLACK);
      const along = u8(mem8[TARGET_SECOND_AXIS] - mem8[slot + SHOT_SECOND_AXIS] + SECOND_AXIS_SLACK);
      if (across < FIRST_AXIS_WINDOW && along < SECOND_AXIS_WINDOW) {
        mem8[TARGET_STATE] = DESTROYED;
        mem8[slot + OCCUPANCY] = DESTROYED;
        postChainedHitScore(m);
      }
    }
    slot = (slot & 0xff00) | u8(slot + SLOT_STRIDE);
  }
}
