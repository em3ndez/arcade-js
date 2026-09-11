// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_10b, loc_10c, loc_a0f7 } from "./names.js";

// Bump the counter; then, only while the gate cell is zero, replace it with a
// table entry selected by the new counter value (a scripted jump).
export function loc_9bfa(m) {
  const { mem8 } = m;
  mem8[loc_10b] = u8(mem8[loc_10b] + 1);
  if (mem8[loc_10c] !== 0) return;
  const y = mem8[loc_10b];
  mem8[loc_10b] = mem8[u16(loc_a0f7 + y)];
}
