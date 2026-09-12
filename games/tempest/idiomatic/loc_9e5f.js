// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_283, loc_2b9, loc_2cc } from "./names.js";
import { loc_9ed7 } from "./loc_9ed7.js";

// Per-slot segment step -- the shared mid-entry body (the guard-less entry). Force bit7 on the
// slot flag, then branch on its low-3-bit segment. Segment 4 (the seam): bit6 set steps the depth
// down one (mod 16) and stores 0x87; bit6 clear stores 0x81 (depth untouched). Any other segment:
// bit6 set steps the depth up one (mod 16); then look the depth up (bit6 selects the half-turn) and
// store the bit7-forced direction. Slot chosen by x; live-out A = the stored direction byte.
export function loc_9e5f(m, x = m.regs.x) {
  const { mem8 } = m;
  const flag = mem8[u16(loc_283 + x)] | 0x80;   // set bit7 on the slot flag, persistently
  mem8[u16(loc_283 + x)] = flag;
  const segment = flag & 0x07;

  if (segment !== 0x04) {                        // ordinary segment
    if (flag & 0x40) {                           // bit6 set -> step depth up one (mod 16)
      mem8[u16(loc_2b9 + x)] = (mem8[u16(loc_2b9 + x)] + 1) & 0x0f;
    }
    const depth = mem8[u16(loc_2b9 + x)];
    const dir = loc_9ed7(m, flag, depth);        // ring lookup, bit6 = half-turn, bit7 forced on
    mem8[u16(loc_2cc + x)] = dir;
    return dir;                                  // live-out A
  }

  let val;                                       // segment 4 (the seam)
  if (flag & 0x40) {                             // bit6 set -> step depth down one (mod 16)
    mem8[u16(loc_2b9 + x)] = (mem8[u16(loc_2b9 + x)] - 1) & 0x0f;
    val = 0x87;
  } else {
    val = 0x81;
  }
  mem8[u16(loc_2cc + x)] = val;
  return (m.regs.a = val);
}
