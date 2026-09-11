// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_2b9, loc_200, loc_283 } from "./names.js";
import { loc_a7a6 } from "./loc_a7a6.js";

// Fetch slot x's target and a shared byte, derive a signed difference, then flip bit6 of
// slot x's flag byte: clear it when the difference's top bit is set, set it otherwise.
export function loc_9d67(m, x = m.regs.x) {
  const { mem8 } = m;
  const y = mem8[u16(loc_2b9 + x)];
  const diff = loc_a7a6(m, mem8[loc_200], y);
  const e = u16(loc_283 + x);
  if (diff & 0x80) mem8[e] &= 0xbf; // top bit set -> clear bit6
  else mem8[e] |= 0x40;             // else set bit6
}
