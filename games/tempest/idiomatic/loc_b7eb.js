// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29, loc_56, loc_58, loc_13b, loc_13c, loc_435, loc_445, loc_b82a, loc_b83d, loc_cec8, loc_cec9 } from "./names.js";
import { loc_c098 } from "./loc_c098.js";
import { loc_c765 } from "./loc_c765.js";
import { loc_b84e } from "./loc_b84e.js";
import { loc_df57 } from "./loc_df53.js";

// Refresh two axis parameters from the per-frame tables, run the two frame updaters, count down the
// sub-timer (on wrap advance the phase and reload the timer), optionally run the phase handler, then
// emit the phase's vector-pair word.
export function loc_b7eb(m) {
  const { mem8, mem16 } = m;
  const y = mem8[loc_29];
  mem8[loc_56] = mem8[u16(loc_435 + y)];
  mem8[loc_58] = mem8[u16(loc_445 + y)];
  loc_c098(m);
  loc_c765(m, 0x61);
  let x = mem8[loc_13b];
  const ticked = (mem8[loc_13c] - 1) & 0xff;
  mem8[loc_13c] = ticked;
  if (ticked === 0) {
    x = (x + 1) & 0xff;
    mem8[loc_13b] = x;
    mem8[loc_13c] = mem8[u16(loc_b82a + x)];
  }
  const phase = mem8[u16(loc_b83d + x)];
  if (phase < 0x80) loc_b84e(m, phase);
  const idx = ((mem8[loc_13b] << 1) + 0x28) & 0xff;
  loc_df57(m, mem8[u16(loc_cec8 + idx)], mem8[u16(loc_cec9 + idx)]);
}
