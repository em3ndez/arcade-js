// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_200, loc_201, loc_283, loc_2b9, loc_2cc } from "./names.js";
import { loc_a33a } from "./loc_a33a.js";

// Per-slot guard: act only when the slot is live and both of its cell coords match
// the current target pair; otherwise leave everything untouched.
export function loc_9e2f(m, x = m.regs.x) {
  const { mem8 } = m;
  if (mem8[u16(loc_283 + x)] & 0x80) return;             // dead slot
  if (mem8[u16(loc_2b9 + x)] !== mem8[loc_200]) return;  // first coord mismatch
  if (mem8[u16(loc_2cc + x)] !== mem8[loc_201]) return;  // second coord mismatch
  loc_a33a(m, x);
}
