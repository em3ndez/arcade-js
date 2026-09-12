// SPDX-License-Identifier: GPL-3.0-only
import { loc_29, loc_2b, loc_2c, loc_2d, loc_15d, loc_9b02 } from "./names.js";

// Seed the demo list pointer pair from a fixed table byte and the held source cell,
// mark the index zero, and reload A from its holding cell.
export function loc_9a9d(m) {
  const { mem8 } = m;
  mem8[loc_2c] = mem8[loc_9b02];
  mem8[loc_2b] = 0x00;
  mem8[loc_2d] = mem8[loc_15d];
  return (m.regs.a = mem8[loc_29]);
}
