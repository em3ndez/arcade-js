// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceSpring — advance ONE 75m spring by one frame, dispatched per slot by the ten-slot
 * sweep with the spring's record and paired sprite record addressed. Four arms in order:
 * inactive slot -> spawn; else a cosmetic tile flicker every 16th frame; OBJ_STATE 4 -> retire;
 * else ordinary travel, inline here. Travel is the bounce: OBJ_X crosses a fixed two pixels
 * while the next byte of a height string is accumulated into OBJ_Y, rewinding at its terminator.
 *
 * LIVE-OUT: memory, plus the two registers the tails read from the register file — the last
 * string byte, and (on the ordinary-byte path) the advanced walk pointer.
 */

import { u16 } from "../../../core/int.js";
import { FRAME, OBJ_ACTIVE, OBJ_STATE, OBJ_X, OBJ_Y, SPRITE_CODE } from "./names.js";
import { spawnObjectIntoInactiveSlot } from "./spawnObjectIntoInactiveSlot.js";
import { loc_2e84 } from "./loc_2e84.js";
import { loc_2e9c } from "./loc_2e9c.js";
import { advanceSpringArcAndDropAtTravelEnd } from "./advanceSpringArcAndDropAtTravelEnd.js";

// Height-string walk pointer offset inside the record (low byte, then high).
const OBJ_STR_PTR = 0x0e;

const FRAME_TOGGLE_MASK = 0x0f;    // the flicker fires once every 16 frames (FRAME low nibble == 0)
const ANIM_TOGGLE_BITS = 0x07;     // low 3 bits of the sprite tile code flipped by the flicker
const CROSS_STEP = 2;              // pixels of horizontal travel per frame — fixed, never scaled
const RETIRE_STATE = 4;            // the OBJ_STATE the step-and-deactivate handler owns
const STRING_TERMINATOR = 0x7f;    // end of the height string: rewind and bounce again

export function advanceSpring(m, record = m.regs.ix, spriteRecord = m.regs.iy) {
  const { mem8 } = m;

  // The tail routines address the object and paired-sprite records through the register file, so
  // each arm seats both cursors on its return bridge before handing off.
  if ((mem8[record + OBJ_ACTIVE] & 0x01) === 0) {
    return (m.regs.ix = record, m.regs.iy = spriteRecord, void spawnObjectIntoInactiveSlot(m));
  }

  // Cosmetic flicker every 16th frame; falls through to the dispatch below.
  if ((mem8[FRAME] & FRAME_TOGGLE_MASK) === 0) {
    mem8[spriteRecord + SPRITE_CODE] = mem8[spriteRecord + SPRITE_CODE] ^ ANIM_TOGGLE_BITS;
  }

  if (mem8[record + OBJ_STATE] === RETIRE_STATE) {
    return (m.regs.ix = record, m.regs.iy = spriteRecord, void loc_2e84(m));
  }

  mem8[record + OBJ_X] = mem8[record + OBJ_X] + CROSS_STEP;

  // Next height-string byte via the record's walk pointer; it is the last-read byte the tails need.
  const ptr = mem8[record + OBJ_STR_PTR] | (mem8[record + OBJ_STR_PTR + 1] << 8);
  const delta = mem8[ptr];

  if (delta === STRING_TERMINATOR) {
    // Re-seat: the terminator tail reads the last string byte and both cursors off the return bridge.
    return (m.regs.ix = record, m.regs.iy = spriteRecord, m.regs.c = delta, void loc_2e9c(m));
  }

  // Step past the byte, accumulate it into OBJ_Y (add, not store), then converge at the tail.
  const next = u16(ptr + 1);
  mem8[record + OBJ_Y] = delta + mem8[record + OBJ_Y];
  return (m.regs.ix = record, m.regs.iy = spriteRecord,
          void advanceSpringArcAndDropAtTravelEnd(m, record, next & 0xff, next >> 8, delta));
}
