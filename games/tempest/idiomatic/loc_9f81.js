// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_283, loc_2b9, loc_111, loc_10b, loc_60ca } from "./names.js";
import { loc_9d67 } from "./loc_9d67.js";
import { loc_9c4f } from "./loc_9c4f.js";
import { loc_9e5f } from "./loc_9e5f.js";

// Entry: re-derive the slot's bit6 from its target, toggle it, then run the shared step.
export function loc_9f81(m, x = m.regs.x) {
  loc_9d67(m, x);
  loc_9c4f(m, x);
  return step9f99(m, x);
}

// Entry: reseed the slot's bit6 from a random bit before the shared step.
export function loc_9f8a(m, x = m.regs.x) {
  const { mem8 } = m;
  const e = u16(loc_283 + x);
  let flag = mem8[e] & 0xbf;                 // clear bit6
  if (mem8[loc_60ca] & 0x40) flag |= 0x40;   // random bit6 reseeds it
  mem8[e] = flag;
  return step9f99(m, x);
}

// Shared tail: on a live board, maybe flip bit6 by the slot's depth, mark a pending step, advance.
function step9f99(m, x) {
  const { mem8 } = m;
  if (mem8[loc_111] !== 0) {
    const e = u16(loc_283 + x);
    const depth = mem8[u16(loc_2b9 + x)];
    const flip = (mem8[e] & 0x40) ? depth === 0 : depth >= 0x0f;
    if (flip) mem8[e] ^= 0x40;
  }
  mem8[loc_10b] = 0x66;
  return loc_9e5f(m, x);
}
