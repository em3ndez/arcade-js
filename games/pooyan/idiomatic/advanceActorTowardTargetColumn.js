// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { advanceActorXAndDispatchMove } from "./advanceActorXAndDispatchMove.js";
import { loc_362d } from "./loc_362d.js";
import { loc_3617 } from "./loc_3617.js";
import { loc_0c45 } from "./loc_0c45.js";
import { loc_0020 } from "./loc_0020.js";
import { setActorAnimation } from "./setActorAnimation.js";
import {
  STAGE_COUNTDOWN,
  ACTIVE_LANE_COUNT,
  ROUND_COUNTER,
  ANIM_FRAME_COUNTER,
  ALT_TARGET_TABLE_PTR,
  SLOT_SPAWN_INDEX,
  TARGET_TILE_ROW_TABLE,
  ANIM_TABLE_3838,
  ANIM_TABLE_3856,
} from "./names.js";

/**
 * advanceActorTowardTargetColumn — actor movement / target-seek AI step for the record at IX.
 *
 * Steps the record's animation, bails to the move+dispatch handler if already latched onto a
 * target, then advances X by the per-record step (a carry bumps the column). Below stage 3 the
 * whole seek is skipped. Otherwise it resolves a target column two ways — the primary tile-row
 * table keyed by the round, or an alternate source when the extra-lane count is set (with a flag
 * bit letting the alternate skip the lookup entirely) — and compares it to the actor column: an
 * exact match hands to the pre-spawn guard, a still-near column (< 0x14) bails, else it latches,
 * picks the approach animation by a record flag bit, and points the record at it.
 *
 * LIVE-OUT: A on the near bail (the actor column, the register-dispatch bridge); the tail handlers
 * set their own. The new X rides B into the stage/guard tails but is persisted to the record.
 */

const REC_X = 0x05;
const REC_COLUMN = 0x06;
const REC_FLAGS = 0x07;
const REC_LATCH = 0x08;
const REC_STEP = 0x09;
const MIN_STAGE = 0x03; // seek runs only from stage 3 on
const NEAR_LIMIT = 0x14; // column below this: too near, bail without latching
const FLAG_SKIP_LOOKUP = 0x04; // alternate flag bit: use the actor column directly
const FLAG_APPROACH_B = 0x02; // flag bit selecting the second approach animation

export function advanceActorTowardTargetColumn(m, rec = m.regs.ix) {
  const { mem8, mem16 } = m;

  advanceObjectAnimationFrame(m, rec); // step the record's animation
  if (mem8[rec + REC_LATCH] !== 0) return advanceActorXAndDispatchMove(m, rec); // already latched

  const sum = mem8[rec + REC_X] + mem8[rec + REC_STEP];
  if (sum > 0xff) mem8[rec + REC_COLUMN] = u8(mem8[rec + REC_COLUMN] + 1); // carry into the column
  const newX = u8(sum);
  mem8[rec + REC_X] = newX;
  if (mem8[STAGE_COUNTDOWN] < MIN_STAGE) return loc_362d(m, rec, newX); // early stage

  const actorCol = mem8[rec + REC_COLUMN];
  const altSource = mem8[ACTIVE_LANE_COUNT] !== 0;
  if (!(altSource && (mem8[rec + REC_FLAGS] & FLAG_SKIP_LOOKUP) === 0)) {
    let base, index;
    if (altSource) {
      base = mem16[ALT_TARGET_TABLE_PTR];
      index = mem8[SLOT_SPAWN_INDEX];
    } else {
      base = loc_0c45(m, (mem8[ROUND_COUNTER] & 0x0f) >> 1, TARGET_TILE_ROW_TABLE);
      index = mem8[ANIM_FRAME_COUNTER] & 0x07;
    }
    const [targetCol] = loc_0020(m, base, index);
    if (actorCol === targetCol) return loc_3617(m, newX); // on target -> pre-spawn guard
  }

  if (actorCol < NEAR_LIMIT) return (m.regs.a = actorCol); // too near -> bail (A = actor column)
  mem8[rec + REC_LATCH] = 0x01; // latch onto the target
  const anim = (mem8[rec + REC_FLAGS] & FLAG_APPROACH_B) === 0 ? ANIM_TABLE_3838 : ANIM_TABLE_3856;
  return setActorAnimation(m, rec, anim);
}
