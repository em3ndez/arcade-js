// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29, loc_2a, loc_11c, loc_2df, loc_2b9, loc_200 } from "./names.js";
import { loc_a7a6 } from "./loc_a7a6.js";

// Scan the table for the smallest nonzero entry, keeping its index. If none, return the last
// entry seen. Otherwise derive a signed difference for that slot and return a code by its sign:
// 0 when zero, 9 when negative, else 0xf7.
export function loc_97c5(m) {
  const { mem8 } = m;
  mem8[loc_29] = 0xff; // smallest value seen
  mem8[loc_2a] = 0xff; // its index, 0xff meaning none
  let a;
  let x = mem8[loc_11c];
  do {
    a = mem8[u16(loc_2df + x)];
    if (a !== 0 && a < mem8[loc_29]) {
      mem8[loc_29] = a;
      mem8[loc_2a] = x;
    }
    x = (x - 1) & 0xff;
  } while ((x & 0x80) === 0);

  const idx = mem8[loc_2a];
  if (idx & 0x80) return (m.regs.a = a); // none found
  const diff = loc_a7a6(m, mem8[u16(loc_2b9 + idx)], mem8[loc_200]);
  if (diff === 0) return (m.regs.a = diff);
  if (diff & 0x80) return (m.regs.a = 0x09);
  return (m.regs.a = 0xf7);
}
