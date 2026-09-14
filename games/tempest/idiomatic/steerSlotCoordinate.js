// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  ENEMY_ANIM_ACCUM, NEAR_DEPTH_THRESHOLD, PLAYER_SEGMENT, PLAYER_FINE_ANGLE, ENEMY_SLOT_DIR, ENEMY_SEGMENT, ENEMY_PHASE, ENEMY_DEPTH, FIRE_GATE,
} from "./names.js";
import { advanceEnemyLaneDepth, reverseEnemyLaneDepth } from "./stepEnemyDepthInLaneDirection.js";
import { insertObjectHeadTag7 } from "./insertObjectHeadTag9.js";

// Per-slot(x) steering step, keyed on ENEMY_SLOT_DIR,x bit7.
//  - bit7 set: SUB-step; probe = FIRE_GATE!=0 ? the step's new hi : 0xff; if probe >= NEAR_DEPTH_THRESHOLD flip bit7
//    of ENEMY_SLOT_DIR,x. Y into the tail = FIRE_GATE.
//  - bit7 clear: ADD-step with y = (ENEMY_DEPTH,x >= NEAR_DEPTH_THRESHOLD ? 0 : 1); Y into the tail = whatever the add
//    step returns (its deep arms overwrite the index, shallow arms keep it).
//  - common tail: with ENEMY_ANIM_ACCUM bit7 clear AND ENEMY_DEPTH,x < NEAR_DEPTH_THRESHOLD AND PLAYER_SEGMENT == ENEMY_SEGMENT,x AND
//    PLAYER_FINE_ANGLE == ENEMY_PHASE,x, seed a fresh object with X = the slot and that Y (which the seed stores).
// X passes through; A on each tail exit is the last compare operand (incidental on the seed arm).
export function steerSlotCoordinate(m, x = m.regs.x) {
  const { mem8 } = m;
  let y;
  if (mem8[u16(ENEMY_SLOT_DIR + x)] & 0x80) {
    const stepped = reverseEnemyLaneDepth(m, x, 1);
    y = mem8[FIRE_GATE]; // ldy FIRE_GATE -- persists as Y into the tail; Z of it picks the probe
    const probe = y !== 0 ? stepped : 0xff;
    if (probe >= mem8[NEAR_DEPTH_THRESHOLD]) mem8[u16(ENEMY_SLOT_DIR + x)] ^= 0x80; // reached threshold -> flip direction
  } else {
    y = mem8[u16(ENEMY_DEPTH + x)] >= mem8[NEAR_DEPTH_THRESHOLD] ? 0 : 1; // steering index into the add step
    [, y] = advanceEnemyLaneDepth(m, x, y); // the tail's seed uses the Y the add step returns
  }
  // common tail
  const c148 = mem8[ENEMY_ANIM_ACCUM];
  if (c148 & 0x80) return (m.regs.a = c148);
  const coord = mem8[u16(ENEMY_DEPTH + x)];
  if (coord >= mem8[NEAR_DEPTH_THRESHOLD]) return (m.regs.a = coord);
  const v200 = mem8[PLAYER_SEGMENT];
  if (v200 !== mem8[u16(ENEMY_SEGMENT + x)]) return (m.regs.a = v200);
  const v201 = mem8[PLAYER_FINE_ANGLE];
  if (v201 !== mem8[u16(ENEMY_PHASE + x)]) return (m.regs.a = v201);
  return insertObjectHeadTag7(m, x, y); // all four match -> seed the object (A left as the callee's leftover)
}
