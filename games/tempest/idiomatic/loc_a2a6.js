// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  loc_119, loc_11a, loc_201, loc_283, loc_28a, loc_2a6, loc_2b5, loc_2b9,
  loc_2c8, loc_2cc, loc_2db, loc_2df, loc_60ca, loc_a6, loc_a304,
} from "./names.js";
import { loc_ccbd } from "./loc_ccbd.js";

// Walk the seven source slots: for each armed, above-threshold slot whose timer
// underflows and whose RNG roll beats the per-wave gate, copy its spawn fields
// into the first free destination slot, reseed the timer, and cue the sound.
export function loc_a2a6(m) {
  const { mem8 } = m;
  if (mem8[loc_201] & 0x80) return;
  for (let x = 6; x >= 0; x--) {
    if (mem8[u16(loc_2df + x)] === 0) continue;
    if (mem8[u16(loc_2df + x)] < 0x30) continue;
    if ((mem8[u16(loc_28a + x)] & 0x40) === 0) continue;
    const dec = u8(mem8[u16(loc_2a6 + x)] - 1);
    mem8[u16(loc_2a6 + x)] = dec;
    if ((dec & 0x80) === 0) continue; // fires only when the timer underflows
    mem8[u16(loc_2a6 + x)] = u8(dec + 1); // restore it
    if (mem8[u16(loc_283 + x)] & 0x80) continue;
    if (mem8[loc_60ca] < mem8[u16(loc_a304 + mem8[loc_a6])]) continue;
    let y = mem8[loc_11a];
    while (true) {
      if (mem8[u16(loc_2db + y)] === 0) {
        mem8[u16(loc_2db + y)] = mem8[u16(loc_2df + x)];
        mem8[u16(loc_2b5 + y)] = mem8[u16(loc_2b9 + x)];
        mem8[u16(loc_2c8 + y)] = mem8[u16(loc_2cc + x)];
        mem8[u16(loc_2a6 + x)] = mem8[loc_119];
        loc_ccbd(m, x, y);
        mem8[loc_a6] = u8(mem8[loc_a6] + 1);
        y = 0; // spawned -> end the free-slot scan
      }
      y = u8(y - 1);
      if (y & 0x80) break;
    }
  }
}
