// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { ENEMY_SLOT_FLAGS, ENEMY_SEGMENT, TUBE_GEOM_FLAG, SCRIPT_CURSOR, POKEY1_RANDOM } from "./names.js";
import { faceEnemyTowardPlayerSegment } from "./faceEnemyTowardPlayerSegment.js";
import { toggleEnemyTurnSide } from "./toggleEnemyTurnSide.js";
import { stepClimberSegmentAndHeading } from "./stepClimberSegmentAndHeading.js";

// Entry: re-derive the slot's bit6 from its target, toggle it, then run the shared step.
export function flipEnemyLaneTowardTarget(m, x = m.regs.x) {
  faceEnemyTowardPlayerSegment(m, x);
  toggleEnemyTurnSide(m, x);
  return step9f99(m, x);
}

// Entry: reseed the slot's bit6 from a random bit before the shared step.
export function flipEnemyLaneRandomSide(m, x = m.regs.x) {
  const { mem8 } = m;
  const e = u16(ENEMY_SLOT_FLAGS + x);
  let flag = mem8[e] & 0xbf;                 // clear bit6
  if (mem8[POKEY1_RANDOM] & 0x40) flag |= 0x40;   // random bit6 reseeds it
  mem8[e] = flag;
  return step9f99(m, x);
}

// Shared tail: on a live board, maybe flip bit6 by the slot's depth, mark a pending step, advance.
function step9f99(m, x) {
  const { mem8 } = m;
  if (mem8[TUBE_GEOM_FLAG] !== 0) {
    const e = u16(ENEMY_SLOT_FLAGS + x);
    const depth = mem8[u16(ENEMY_SEGMENT + x)];
    const flip = (mem8[e] & 0x40) ? depth === 0 : depth >= 0x0f;
    if (flip) mem8[e] ^= 0x40;
  }
  mem8[SCRIPT_CURSOR] = 0x66;
  return stepClimberSegmentAndHeading(m, x);
}
