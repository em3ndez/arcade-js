// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  loc_00, loc_5, loc_9, loc_3d, loc_40, loc_42, loc_48, loc_4d, loc_5b, loc_5f,
  loc_a6, loc_106, loc_108, loc_109, loc_10f, loc_114, loc_116, loc_11b, loc_11c,
  loc_135, loc_201, loc_202, loc_2df, loc_3ab, loc_455,
} from "./names.js";
import { loc_928f } from "./loc_928f.js";
import { loc_a5cb } from "./loc_a5cb.js";

// A control byte's sign splits two arms: the positive arm bumps a per-slot timer
// cell and conditionally resets shot state; the negative arm ages the shot table,
// advances a clock, and clamps a running total.
export function loc_a504(m) {
  const { mem8 } = m;

  if (mem8[loc_201] < 0x80) {
    // ----- positive arm -----
    // Bump the timer cell only when a gate is live and a limit is not yet reached.
    if ((mem8[loc_455] | mem8[loc_11b]) !== 0 && 0x17 < mem8[loc_42]) {
      const x = mem8[loc_40];
      mem8[u8(loc_00 + x)] = u8(mem8[u8(loc_00 + x)] + 1);
    }
    if (mem8[loc_106] !== 0) return;
    if ((mem8[loc_3ab] | mem8[loc_116]) === 0) {
      // Reset unless any live shot has already grown past the threshold.
      let y = mem8[loc_11c];
      let anyBig = false;
      for (;;) {
        const v = mem8[u16(loc_2df + y)];
        if (v !== 0 && v >= 0x11) { anyBig = true; break; }
        y = u8(y - 1);
        if (y >= 0x80) break;
      }
      if (!anyBig) { loc_a5cb(m); loc_928f(m); }
    }
    if ((mem8[loc_4d] & 0x60) === 0) return;
    if ((mem8[loc_5] & 0x80) === 0) return;
    if ((mem8[loc_9] & 0x43) !== 0x40) return;
    loc_a5cb(m);
    return;
  }

  // ----- negative arm -----
  if ((mem8[loc_135] | mem8[loc_a6] | mem8[loc_116]) !== 0) return;
  // Age each live shot by a fixed step, snapping to zero at the ceiling.
  for (let x = mem8[loc_11c]; ; ) {
    const cur = mem8[u16(loc_2df + x)];
    if (cur !== 0) {
      const v = cur + 0x0f;
      mem8[u16(loc_2df + x)] = v >= 0xf0 ? 0x00 : v;
    }
    x = u8(x - 1);
    if (x >= 0x80) break;
  }

  let proceed;
  const idx = mem8[loc_3d];
  if (mem8[u8(loc_48 + idx)] !== 0x01) {
    // Advance one counter; proceed once it crosses the ceiling.
    const v = mem8[loc_202] + 0x0f;
    mem8[loc_202] = u8(v);
    proceed = v >= 0xf0;
  } else {
    // Reset two flags and step a 16-bit clock down; proceed at a marker value.
    mem8[loc_10f] = 0x00;
    mem8[loc_114] = 0x01;
    const lo = mem8[loc_5f] - 0x20;
    mem8[loc_5f] = u8(lo);
    const hi = mem8[loc_5b] - (lo < 0 ? 1 : 0);
    mem8[loc_5b] = u8(hi);
    proceed = u8(hi) === 0xfa;
  }
  if (!proceed) return;

  mem8[loc_00] = 0x06;
  loc_928f(m);
  const sum = u8(mem8[loc_108] + mem8[loc_109] + mem8[loc_3ab]);
  mem8[loc_3ab] = sum >= 0x3f ? 0x3f : sum;
}
