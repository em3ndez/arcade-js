// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  PLAYER_SHOT_DEPTH, ENEMY_DEPTH, ENEMY_SLOT_FLAGS, FIRE_GATE, ENEMY_SLOT_DIR, ENEMY_TOTAL_COUNT, ENEMY_TYPE_COUNT, TABLE_CURSOR, SCRIPT_CURSOR, ENEMY_SEGMENT,
} from "./names.js";
import { loc_9d67 } from "./loc_9d67.js";

// Per-slot step: stash the shared byte into slot x, then act on the slot's kind.
// Returns the Y live-out the caller's tail reads (the scan index / ENEMY_SEGMENT,x); the two early
// exits leave Y untouched, so they return undefined ("keep the caller's Y").
export function loc_9d06(m, x = m.regs.x) {
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
    loc_9d67(m, x);
    yOut = mem8[u16(ENEMY_SEGMENT + x)]; // the deeper step leaves Y = ENEMY_SEGMENT,x
  }

  mem8[SCRIPT_CURSOR] = 0x41;
  mem8[ENEMY_TYPE_COUNT] = u8(mem8[ENEMY_TYPE_COUNT] + 1);
  return yOut; // Y live-out for the caller's seed tail
}
