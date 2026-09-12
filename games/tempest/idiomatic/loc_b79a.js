// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  loc_9e, loc_9f, loc_37, loc_57, loc_29, loc_1ff, loc_720,
  loc_30a, loc_2fa, loc_302, loc_312, loc_b7e5,
} from "./names.js";
import { loc_b7eb } from "./loc_b7eb.js";
import { loc_bcfd } from "./loc_bcfd.js";

// Walk the eight active slots top-down, emitting each non-empty slot's shape record
// (a special case for shape 1), then latch a saved byte when a flag and threshold hold.
export function loc_b79a(m) {
  const { mem8 } = m;
  mem8[loc_9e] = 0x00;
  mem8[loc_37] = 0x07;
  while (true) {
    const slot = mem8[loc_37];
    const cell = mem8[u16(loc_30a + slot)];
    if (cell !== 0) {
      mem8[loc_57] = cell;
      mem8[loc_29] = mem8[u16(loc_2fa + slot)];
      const shape = mem8[u16(loc_302 + slot)];
      if (shape === 1) {
        loc_b7eb(m);
      } else {
        let base = (mem8[u16(loc_312 + slot)] >> 1) & 0xfe;
        if (shape >= 2) base = 0x00;
        const val = (base + mem8[u16(loc_b7e5 + shape)]) & 0xff;
        loc_bcfd(m, val, mem8[loc_29]);
      }
    }
    const next = (mem8[loc_37] - 1) & 0xff;
    mem8[loc_37] = next;
    if (next & 0x80) break;
  }
  if (mem8[loc_720] === 0) return;
  const saved = mem8[loc_9f];
  if (saved < 0x0d) return;
  mem8[loc_1ff] = saved;
}
