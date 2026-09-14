// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  SLOT_LOOP_INDEX, SCRIPT_WALK_CONTINUE, SCRIPT_CURSOR, ENEMY_SLOT_TOP, LANE_ENEMY_COUNT_1, ENEMY_ANIM_DELTA, ENEMY_ANIM_ACCUM, PLAYER_FINE_ANGLE, ENEMY_SCRIPT_CURSOR, ENEMY_DEPTH, MOTION_SCRIPT_TABLE,
} from "./names.js";
import { dispatchSlotMotionHandler } from "./dispatchSlotMotionHandler.js";
import { cueSpikeCollisionSound } from "./cueSpikeCollisionSound.js";
import { requestMotionFlipSound } from "./requestMotionFlipSound.js";

// When PLAYER_FINE_ANGLE is nonnegative, walk slots SLOT_LOOP_INDEX = ENEMY_SLOT_TOP down to 0: for each nonzero ENEMY_DEPTH,x run a
// per-entry motion pass — SCRIPT_CURSOR indexes a table into the motion dispatcher, advancing SCRIPT_CURSOR
// until the continue flag SCRIPT_WALK_CONTINUE clears — then store SCRIPT_CURSOR back to ENEMY_SCRIPT_CURSOR,x. Then signed-accumulate the
// delta ENEMY_ANIM_DELTA into ENEMY_ANIM_ACCUM; a sign flip triggers the cd06/cd02 corrections; finally, when ENEMY_ANIM_ACCUM leaves
// the [0x0f, 0xc0] band, negate ENEMY_ANIM_DELTA to reverse direction.
// xIn seeds the value the loop leaves in X for the tail sound cue: no routine in this dispatch
// subtree rewrites X, so after the walk X = the last non-empty slot processed (or the incoming X if
// the walk seated none). lastX mirrors that and is threaded to the tail sound cue that stores it.
export function runObjectMotionScripts(m, xIn = m.regs.x) {
  const { mem8 } = m;
  let lastX = xIn;

  if ((mem8[PLAYER_FINE_ANGLE] & 0x80) === 0) {          // PLAYER_FINE_ANGLE >= 0 (else the outer walk is skipped)
    mem8[SLOT_LOOP_INDEX] = mem8[ENEMY_SLOT_TOP];
    do {
      const x = mem8[SLOT_LOOP_INDEX];
      if (mem8[u16(ENEMY_DEPTH + x)] !== 0) {
        lastX = x; // the slot the loop leaves in X
        mem8[SCRIPT_WALK_CONTINUE] = 1;
        mem8[SCRIPT_CURSOR] = mem8[u16(ENEMY_SCRIPT_CURSOR + x)];
        do {
          // the slot x rides into the dispatcher's handlers as an explicit arg
          dispatchSlotMotionHandler(m, mem8[u16(MOTION_SCRIPT_TABLE + mem8[SCRIPT_CURSOR])], x); // dispatch on the table entry at the cursor
          mem8[SCRIPT_CURSOR] = u8(mem8[SCRIPT_CURSOR] + 1);
        } while (mem8[SCRIPT_WALK_CONTINUE] !== 0);
        mem8[u16(ENEMY_SCRIPT_CURSOR + x)] = mem8[SCRIPT_CURSOR];
      }
      mem8[SLOT_LOOP_INDEX] = u8(mem8[SLOT_LOOP_INDEX] - 1);
    } while ((mem8[SLOT_LOOP_INDEX] & 0x80) === 0);      // until SLOT_LOOP_INDEX decrements past 0
  }

  // signed accumulate ENEMY_ANIM_DELTA into ENEMY_ANIM_ACCUM
  const old148 = mem8[ENEMY_ANIM_ACCUM];
  const sum = u8(old148 + mem8[ENEMY_ANIM_DELTA]);
  mem8[ENEMY_ANIM_ACCUM] = sum;
  if ((sum ^ old148) & 0x80) {                  // the accumulate crossed a sign boundary
    if (sum & 0x80) {
      cueSpikeCollisionSound(m, lastX); // the loop's leftover X feeds the sound cue; Y stays the loop's leftover
    } else if (mem8[LANE_ENEMY_COUNT_1] !== 0 && (mem8[PLAYER_FINE_ANGLE] & 0x80) === 0) {
      requestMotionFlipSound(m, lastX);
    }
  }

  // clamp: negate the delta when ENEMY_ANIM_ACCUM sits in the [0x0f, 0xc0] band
  const v = mem8[ENEMY_ANIM_ACCUM];
  const negate = (v & 0x80) === 0 ? v >= 0x0f : v < 0xc1;
  if (negate) mem8[ENEMY_ANIM_DELTA] = u8((mem8[ENEMY_ANIM_DELTA] ^ 0xff) + 1);
}
