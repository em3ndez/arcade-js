// SPDX-License-Identifier: GPL-3.0-only
/** destroyFixedTargetHitByShots — run one fixed target against the six-slot shot array and destroy the shots that
 * reached it. The target's state byte must read live before the sweep (tested once, ahead of the loop); each live
 * slot is then tested on both axes as a wrapped window around the target, and a slot inside both is marked destroyed
 * with the target and its score posted. The sweep runs on through the remaining slots, so every overlapping shot is
 * spent and scores in the one call. Slot addressing steps only the low half of the cursor, so a wide enough array
 * would wrap inside its page. LIVE-OUT: the memory it destroys and scores; and the register file it leaves — the two
 * box dimensions in H/L and D/E, the cursor in IY (the base on the early exit, one page-step past the last slot after
 * the sweep), the slot count in B (untouched on the early exit, run down to zero by the sweep), and A/F from the
 * target's own liveness test on the early exit, or from the final page-step of the cursor after the sweep. */

import { postChainedHitScore } from "./postChainedHitScore.js";
import { u8 } from "../../../core/int.js";
import { F_S, F_Z, F_H, F_PV, F_C, F_F3, F_F5 } from "../../../core/cpu/z80.js";
import { ERA_OBJECT_ENTRY_SLOT0, ERA_OBJECT_RECORD_SLOT0, ERA_OBJECT_SPRITE_Y_SLOT0, PLAYER_SHOT_ARRAY } from "./names.js";

const SLOTS = 6;
const SLOT_STRIDE = 0x10;

const OCCUPANCY = 0;
const SHOT_FIRST_AXIS = 6;
const SHOT_SECOND_AXIS = 4;

const FIRST_AXIS_SLACK = 6;
const FIRST_AXIS_WINDOW = 0x0d;
const SECOND_AXIS_SLACK = 0x17;
const SECOND_AXIS_WINDOW = 0x1f;

const LIVE = 0xff;
const DESTROYED = 0xf0;

/** The accumulator and its flags the last page-step of the cursor leaves: 0xd0 + 0x10 = 0xe0, no carry. */
const CURSOR_STEP_A = 0xe0;
const CURSOR_STEP_F = F_S | (CURSOR_STEP_A & (F_F3 | F_F5));

export function destroyFixedTargetHitByShots(m, incomingFlags = m.regs.f) {
  const { mem8 } = m;
  const record = mem8[ERA_OBJECT_RECORD_SLOT0];
  if (record !== LIVE) {
    // The liveness test is `inc a` on the record byte read into A: A is left one past it, and the flags
    // are the inc flags with carry carried in from entry (inc does not touch carry).
    const a = u8(record + 1);
    const f =
      (incomingFlags & F_C) |
      (a & F_S) |
      (a === 0 ? F_Z : 0) |
      (a & (F_F3 | F_F5)) |
      ((a & 0x0f) === 0 ? F_H : 0) |
      (a === 0x80 ? F_PV : 0);
    return (m.regs.a = a, m.regs.f = f, m.regs.b = SLOTS, m.regs.d = SECOND_AXIS_WINDOW, m.regs.e = SECOND_AXIS_SLACK, m.regs.h = FIRST_AXIS_WINDOW, m.regs.l = FIRST_AXIS_SLACK, m.regs.iy = PLAYER_SHOT_ARRAY);
  }

  let slot = PLAYER_SHOT_ARRAY;
  for (let i = 0; i < SLOTS; i++) {
    if (mem8[slot + OCCUPANCY] === LIVE) {
      const across = u8(mem8[ERA_OBJECT_ENTRY_SLOT0] - mem8[slot + SHOT_FIRST_AXIS] + FIRST_AXIS_SLACK);
      const along = u8(mem8[ERA_OBJECT_SPRITE_Y_SLOT0] - mem8[slot + SHOT_SECOND_AXIS] + SECOND_AXIS_SLACK);
      if (across < FIRST_AXIS_WINDOW && along < SECOND_AXIS_WINDOW) {
        mem8[ERA_OBJECT_RECORD_SLOT0] = DESTROYED;
        mem8[slot + OCCUPANCY] = DESTROYED;
        postChainedHitScore(m);
      }
    }
    slot = (slot - (slot & 0xff)) | u8(slot + SLOT_STRIDE);
  }

  return (m.regs.a = CURSOR_STEP_A, m.regs.f = CURSOR_STEP_F, m.regs.b = 0, m.regs.d = SECOND_AXIS_WINDOW, m.regs.e = SECOND_AXIS_SLACK, m.regs.h = FIRST_AXIS_WINDOW, m.regs.l = FIRST_AXIS_SLACK, m.regs.iy = slot);
}
