// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29, loc_2b, loc_2c, loc_2d, loc_9afd, loc_9b02 } from "./names.js";

// Load a pointer pair from two tables indexed by Y into the low and high pointer cells,
// stash the index, and reload A from its holding cell. Sets up the indirect pointer that
// the coordinate walkers then chase.
export function loc_9aee(m, y = m.regs.y) {
  const { mem8 } = m;
  mem8[loc_2c] = mem8[u16(loc_9b02 + y)];
  mem8[loc_2d] = mem8[u16(loc_9afd + y)];
  mem8[loc_2b] = y;
  const a = mem8[loc_29];
  return (m.regs.a = a);
}
