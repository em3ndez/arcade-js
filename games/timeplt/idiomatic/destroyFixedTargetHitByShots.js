// SPDX-License-Identifier: GPL-3.0-only
/** destroyFixedTargetHitByShots — run one fixed target against the six-slot shot array and destroy the shots that
 * reached it. The target's state byte reads live before the sweep; each live slot is then tested on
 * both axes as a wrapped window around the target, and a slot inside both is marked destroyed with
 * the target and its score posted. The sweep runs on through the remaining slots, so every
 * overlapping shot is spent and scores in the one call. The slot cursor steps only the low half of
 * its address, so a wide enough array would wrap inside its page.
 * LIVE-OUT: the memory it destroys and scores, plus three registers a later sibling sweep reads —
 * the second-axis slack in E, the slot cursor in IY (the array base on the early exit, one page-step
 * past the last slot after the sweep), and the carry in F (ridden in from entry on the early exit,
 * cleared by the final page-step after the sweep). The box widths, the slot count and the stepped
 * accumulator are dead after return and are held here as JS locals. */

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

/** The carry-clear flags the last page-step of the cursor leaves: value 0xd0 + value 0x10 = value 0xe0,
 * which sets S and the two undocumented bits and carries nothing out. */
const CURSOR_STEP_A = 0xe0;
const CURSOR_STEP_F = F_S | (CURSOR_STEP_A & (F_F3 | F_F5));

export function destroyFixedTargetHitByShots(m, incomingFlags = m.regs.f) {
  const { mem8 } = m;
  const record = mem8[ERA_OBJECT_RECORD_SLOT0];
  if (record !== LIVE) {
    // The liveness test is `inc a` on the record byte: the stepped value is dead scratch, kept only
    // to derive the flags, and carry rides in from entry unchanged (inc does not touch it).
    const stepped = u8(record + 1);
    const f =
      (incomingFlags & F_C) |
      (stepped & F_S) |
      (stepped === 0 ? F_Z : 0) |
      (stepped & (F_F3 | F_F5)) |
      ((stepped & 0x0f) === 0 ? F_H : 0) |
      (stepped === 0x80 ? F_PV : 0);
    return (m.regs.f = f, m.regs.e = SECOND_AXIS_SLACK, m.regs.iy = PLAYER_SHOT_ARRAY, undefined);
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

  return (m.regs.f = CURSOR_STEP_F, m.regs.e = SECOND_AXIS_SLACK, m.regs.iy = slot, undefined);
}
