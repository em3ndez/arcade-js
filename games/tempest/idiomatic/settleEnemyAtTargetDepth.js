// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  PLAYER_SHOT_DEPTH, ENEMY_DEPTH, ENEMY_SLOT_FLAGS, FIRE_GATE, ENEMY_SLOT_DIR, ENEMY_TOTAL_COUNT, ENEMY_TYPE_COUNT, TABLE_CURSOR, SCRIPT_CURSOR, ENEMY_SEGMENT,
} from "./names.js";
import { faceEnemyTowardPlayerSegment } from "./faceEnemyTowardPlayerSegment.js";

/**
 * settleEnemyAtTargetDepth -- settle enemy slot x at the target tube depth. ROM 0x9d06.
 *
 * Role in the machine: when a climbing enemy reaches the depth floor of its lane, this decides what
 * the slot does next -- flip and fire, keep sinking, or re-aim / hand off to a neighbour. It is
 * called per-slot from the depth-stepper once the slot's new high byte has crossed the floor, and it
 * threads Y back out so the caller's shared seed tail can resume where the branch left off.
 *
 * Behavior: it first stashes the shared floor byte PLAYER_SHOT_DEPTH into this slot's depth cell
 * ENEMY_DEPTH,x. Two early exits follow. A kind-1 slot (low three bits of ENEMY_SLOT_FLAGS,x == 1)
 * with the fire gate FIRE_GATE armed just flips bit7 of ENEMY_SLOT_DIR,x and returns; a slot whose
 * flag byte is negative (bit7 set) merely bumps its stashed depth and returns. Both early exits
 * leave Y untouched (return undefined = "keep the caller's Y"). Otherwise it drops the live
 * ENEMY_TOTAL_COUNT and splits on the per-type count ENEMY_TYPE_COUNT: when that count is 1 it scans
 * slots 6..0 for a non-empty, non-self neighbour whose stashed depth matches the shared byte,
 * recording the scan index in TABLE_CURSOR, and copies that neighbour's bit6 (inverted) into this
 * slot's flag byte -- the loser index (0xff) leaks through when nothing matches. When the per-type
 * count is not 1 it re-aims the slot toward the player via faceEnemyTowardPlayerSegment, which leaves
 * Y = ENEMY_SEGMENT,x. Finally it marks SCRIPT_CURSOR = 0x41 and bumps ENEMY_TYPE_COUNT.
 *
 * Live-out: ENEMY_DEPTH,x, ENEMY_SLOT_DIR,x or ENEMY_SLOT_FLAGS,x, ENEMY_TOTAL_COUNT,
 * ENEMY_TYPE_COUNT, SCRIPT_CURSOR, TABLE_CURSOR (scan path), and the Y register (scan index or
 * ENEMY_SEGMENT,x) that the caller's seed tail reads. Grounding: [seen].
 */
export function settleEnemyAtTargetDepth(m, x = m.regs.x) {
  const { mem8 } = m;
  const shared = mem8[PLAYER_SHOT_DEPTH];
  mem8[u16(ENEMY_DEPTH + x)] = shared;

  // Kind 1 with the gate byte set: flip bit7 of the slot's flag and stop.
  if ((mem8[u16(ENEMY_SLOT_FLAGS + x)] & 0x07) === 1 && mem8[FIRE_GATE] !== 0) {
    mem8[u16(ENEMY_SLOT_DIR + x)] ^= 0x80;
    return;
  }
  // A negative slot just bumps its stashed byte and stops.
  if (mem8[u16(ENEMY_SLOT_FLAGS + x)] & 0x80) {
    mem8[u16(ENEMY_DEPTH + x)] = u8(mem8[u16(ENEMY_DEPTH + x)] + 1);
    return;
  }

  mem8[ENEMY_TOTAL_COUNT] = u8(mem8[ENEMY_TOTAL_COUNT] - 1);
  let yOut;
  if (mem8[ENEMY_TYPE_COUNT] === 1) {
    // Scan slots 6..0 for a non-empty, non-self entry whose stashed byte matches
    // the shared one; the loser index leaks through when none matches.
    let y = 6;
    for (;;) {
      if (mem8[u16(ENEMY_DEPTH + y)] !== 0) {
        mem8[TABLE_CURSOR] = y;
        if (x !== y && mem8[u16(ENEMY_DEPTH + y)] === shared) break;
      }
      y = u8(y - 1);
      if (y >= 0x80) break;
    }
    // Copy the matched slot's bit6, inverted, into slot x's flag byte.
    mem8[u16(ENEMY_SLOT_FLAGS + x)] = (mem8[u16(ENEMY_SLOT_FLAGS + y)] & 0x40) ^ 0x40;
    yOut = y; // the scan index (matched slot, or 0xff on no match)
  } else {
    faceEnemyTowardPlayerSegment(m, x);
    yOut = mem8[u16(ENEMY_SEGMENT + x)]; // the deeper step leaves Y = ENEMY_SEGMENT,x
  }

  mem8[SCRIPT_CURSOR] = 0x41;
  mem8[ENEMY_TYPE_COUNT] = u8(mem8[ENEMY_TYPE_COUNT] + 1);
  return yOut; // Y live-out for the caller's seed tail
}
