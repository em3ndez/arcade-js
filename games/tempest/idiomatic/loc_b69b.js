// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  loc_3, loc_56, loc_57, loc_58, loc_a9,
  loc_2b9, loc_2cc, loc_2df, loc_3ce, loc_3de, loc_cec8, loc_cec9,
} from "./names.js";
import { loc_b6fa } from "./loc_b6fa.js";
import { loc_c098 } from "./loc_c098.js";
import { loc_c765 } from "./loc_c765.js";
import { loc_bd3e } from "./loc_bd3e.js";
import { loc_df59 } from "./loc_df59.js";

// Build a screen position for slot x and tail into the vector emitter. Load the slot coord and the
// segment-indexed base pair; when the phase byte is negative, interpolate the pair toward the next
// segment by scaling the delta through the fraction helper. Fold the live deltas, lay the fixed
// header, then append the (mantissa, exponent) pair: the appender returns its exit cursor, which is
// persisted and reloaded as the emitter's cursor offset. The entry template is read from a word
// table indexed by the frame's low bits.
export function loc_b69b(m, x = m.regs.x) {
  const { mem8 } = m;

  mem8[loc_57] = mem8[u16(loc_2df + x)];
  const seg = mem8[u16(loc_2b9 + x)];
  mem8[loc_56] = mem8[u16(loc_3ce + seg)];
  mem8[loc_58] = mem8[u16(loc_3de + seg)];

  const phase = mem8[u16(loc_2cc + x)];
  if (phase & 0x80) {
    const next = (seg + 1) & 0x0f; // next segment index
    let d0 = (mem8[u16(loc_3ce + next)] - mem8[loc_56]) & 0xff;
    d0 = loc_b6fa(m, d0, x);
    mem8[loc_56] = d0 + mem8[loc_56];
    let d1 = (mem8[u16(loc_3de + next)] - mem8[loc_58]) & 0xff;
    d1 = loc_b6fa(m, d1, x);
    mem8[loc_58] = d1 + mem8[loc_58];
  }

  loc_c098(m);
  loc_c765(m, 0x61);
  mem8[loc_a9] = 0x00;
  const yExit = loc_bd3e(m);   // appended pair returns its exit cursor
  mem8[loc_a9] = yExit;        // persist the cursor for the emitter

  const idx = (((mem8[loc_3] & 0x03) << 1) + 0x4e) & 0xff;
  const a = mem8[u16(loc_cec8 + idx)];
  const hx = mem8[u16(loc_cec9 + idx)];
  const y = mem8[loc_a9];
  return loc_df59(m, a, hx, y);
}
