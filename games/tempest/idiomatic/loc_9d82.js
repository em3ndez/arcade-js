// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_2cc, loc_283, loc_2b9, loc_28a, loc_3ab, loc_2df, loc_202, loc_10c } from "./names.js";
import { loc_9ed7 } from "./loc_9ed7.js";
import { loc_9f81 } from "./loc_9f81.js";

// Advance slot x's turn animation: step its phase counter, then branch on the low 3 bits of the
// state byte. State 4 settles a turn (rotate the coord, reseed the phase, flip a sign, maybe kick
// off the next step); otherwise re-aim and walk the coord one step toward the target on a match.
// Every exit stashes the state byte's bit7 in a shared flag.
export function loc_9d82(m, x = m.regs.x) {
  const { mem8 } = m;

  // Phase counter: step one increment by the state's bit6, keep a nibble, force bit7.
  const stepDown = mem8[u16(loc_283 + x)] & 0x40;
  const phase = (stepDown ? mem8[u16(loc_2cc + x)] - 1 : mem8[u16(loc_2cc + x)] + 1) & 0xff;
  mem8[u16(loc_2cc + x)] = (phase & 0x0f) | 0x80;

  if ((mem8[u16(loc_283 + x)] & 0x07) !== 0x04) {
    // Not settling: re-derive the target direction; act only when it matches the phase.
    const dir = loc_9ed7(m, mem8[u16(loc_283 + x)] ^ 0x40, mem8[u16(loc_2b9 + x)]);
    if (dir === mem8[u16(loc_2cc + x)]) {
      const flag = mem8[u16(loc_283 + x)] & 0x7f; // drop bit7
      mem8[u16(loc_283 + x)] = flag;
      if (flag & 0x40) {
        mem8[u16(loc_2cc + x)] = (mem8[u16(loc_2b9 + x)] + 1) & 0x0f;
      } else {
        const coord = mem8[u16(loc_2b9 + x)];
        mem8[u16(loc_2cc + x)] = coord;
        mem8[u16(loc_2b9 + x)] = (coord - 1) & 0x0f;
      }
    }
  } else if ((mem8[u16(loc_2cc + x)] & 0x07) === 0) {
    // Settling and the phase reached a step boundary: rotate, reseed, flip sign.
    if (mem8[u16(loc_2cc + x)] & 0x08) {
      mem8[u16(loc_2b9 + x)] = (mem8[u16(loc_2b9 + x)] + 1) & 0x0f;
    }
    mem8[u16(loc_283 + x)] &= 0x7f;
    mem8[u16(loc_2cc + x)] = 0x20;
    mem8[u16(loc_28a + x)] ^= 0x80;
    if (mem8[loc_3ab] === 0) {
      if (mem8[u16(loc_2df + x)] === mem8[loc_202]) {
        loc_9f81(m, x);
      } else {
        mem8[u16(loc_28a + x)] &= 0x80; // isolate the sign bit
      }
    }
  }

  mem8[loc_10c] = mem8[u16(loc_283 + x)] & 0x80;
}
