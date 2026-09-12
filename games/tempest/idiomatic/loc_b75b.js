// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_37, loc_2d3, loc_57, loc_2f, loc_2ad, loc_3, loc_135, loc_808 } from "./names.js";
import { loc_bcfd } from "./loc_bcfd.js";

// Walk twelve slots high-to-low, emitting each non-empty entry's shape, then latch a level byte.
export function loc_b75b(m) {
  const { mem8 } = m;
  mem8[loc_37] = 0x0b;
  while (true) {
    const x = mem8[loc_37];
    const entry = mem8[u16(loc_2d3 + x)];
    if (entry !== 0) {
      mem8[loc_57] = entry;
      mem8[loc_2f] = entry;
      const y = mem8[u16(loc_2ad + x)];
      // Near slots use a fixed value; far slots derive one from the phase counter.
      const a = x >= 0x08 ? (((mem8[loc_3] << 1) & 0x06) + 0x20) & 0xff : 0x08;
      loc_bcfd(m, a, y);
    }
    const next = (mem8[loc_37] - 1) & 0xff;
    mem8[loc_37] = next;
    if (next & 0x80) break;
  }
  // Latch a level byte selected by the current stage value.
  const level = mem8[loc_135];
  mem8[loc_808] = level < 0x06 ? 0x04 : level < 0x08 ? 0x0b : 0x0c;
}
