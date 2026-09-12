// SPDX-License-Identifier: GPL-3.0-only
import { loc_b85f } from "./loc_b85f.js";
import { loc_b875 } from "./loc_b875.js";
import { loc_b888 } from "./loc_b888.js";
import { loc_b896 } from "./loc_b896.js";

// Computed dispatch: the caller passes Y as a byte offset into a 2-byte-per-entry table (0,2,4,6).
// Select the entry and tail-return the dispatched routine's result.
const TABLE = [loc_b85f, loc_b875, loc_b888, loc_b896];

export function loc_b84e(m, y = m.regs.y) {
  return TABLE[y >> 1](m);
}
