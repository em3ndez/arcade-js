// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { ENEMY_PHASE, ENEMY_SLOT_FLAGS, ENEMY_SEGMENT, ENEMY_SLOT_DIR, FIRE_GATE, ENEMY_DEPTH, PLAYER_SHOT_DEPTH, SCRIPT_BRANCH_FLAG } from "./names.js";
import { loc_9ed7 } from "./loc_9ed7.js";
import { loc_9f81 } from "./loc_9f81.js";

// Advance slot x's turn animation: step its phase counter, then branch on the low 3 bits of the
// state byte. State 4 settles a turn (rotate the coord, reseed the phase, flip a sign, maybe kick
// off the next step); otherwise re-aim and walk the coord one step toward the target on a match.
// Every exit stashes the state byte's bit7 in a shared flag.
export function loc_9d82(m, x = m.regs.x) {
  const { mem8 } = m;

  // Phase counter: step one increment by the state's bit6, keep a nibble, force bit7.
  const stepDown = mem8[u16(ENEMY_SLOT_FLAGS + x)] & 0x40;
  const phase = (stepDown ? mem8[u16(ENEMY_PHASE + x)] - 1 : mem8[u16(ENEMY_PHASE + x)] + 1) & 0xff;
  mem8[u16(ENEMY_PHASE + x)] = (phase & 0x0f) | 0x80;

  if ((mem8[u16(ENEMY_SLOT_FLAGS + x)] & 0x07) !== 0x04) {
    // Not settling: re-derive the target direction; act only when it matches the phase.
    const dir = loc_9ed7(m, mem8[u16(ENEMY_SLOT_FLAGS + x)] ^ 0x40, mem8[u16(ENEMY_SEGMENT + x)]);
    if (dir === mem8[u16(ENEMY_PHASE + x)]) {
      const flag = mem8[u16(ENEMY_SLOT_FLAGS + x)] & 0x7f; // drop bit7
      mem8[u16(ENEMY_SLOT_FLAGS + x)] = flag;
      if (flag & 0x40) {
        mem8[u16(ENEMY_PHASE + x)] = (mem8[u16(ENEMY_SEGMENT + x)] + 1) & 0x0f;
      } else {
        const coord = mem8[u16(ENEMY_SEGMENT + x)];
        mem8[u16(ENEMY_PHASE + x)] = coord;
        mem8[u16(ENEMY_SEGMENT + x)] = (coord - 1) & 0x0f;
      }
    }
  } else if ((mem8[u16(ENEMY_PHASE + x)] & 0x07) === 0) {
    // Settling and the phase reached a step boundary: rotate, reseed, flip sign.
    if (mem8[u16(ENEMY_PHASE + x)] & 0x08) {
      mem8[u16(ENEMY_SEGMENT + x)] = (mem8[u16(ENEMY_SEGMENT + x)] + 1) & 0x0f;
    }
    mem8[u16(ENEMY_SLOT_FLAGS + x)] &= 0x7f;
    mem8[u16(ENEMY_PHASE + x)] = 0x20;
    mem8[u16(ENEMY_SLOT_DIR + x)] ^= 0x80;
    if (mem8[FIRE_GATE] === 0) {
      if (mem8[u16(ENEMY_DEPTH + x)] === mem8[PLAYER_SHOT_DEPTH]) {
        loc_9f81(m, x);
      } else {
        mem8[u16(ENEMY_SLOT_DIR + x)] &= 0x80; // isolate the sign bit
      }
    }
  }

  mem8[SCRIPT_BRANCH_FLAG] = mem8[u16(ENEMY_SLOT_FLAGS + x)] & 0x80;
}
