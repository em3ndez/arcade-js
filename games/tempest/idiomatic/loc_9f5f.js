// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_2df, loc_60da, loc_15f, loc_159 } from "./names.js";
import { loc_9f81, loc_9f8a } from "./loc_9f81.js";

// Per-slot fire gate: fire only when the slot's fire bit is set and a fresh random draw
// clears the threshold; a target flag or the slot parity then picks which step runs.
export function loc_9f5f(m, x = m.regs.x) {
  const { mem8 } = m;
  if ((mem8[u16(loc_2df + x)] & 0x20) === 0) return;   // fire bit clear
  if (mem8[loc_60da] < mem8[loc_15f]) return;          // random below threshold
  if ((mem8[loc_159] & 0x40) === 0) return loc_9f8a(m, x);
  if ((x & 1) === 0) return loc_9f8a(m, x);            // even slot
  return loc_9f81(m, x);                               // odd slot
}
