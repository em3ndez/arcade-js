// SPDX-License-Identifier: GPL-3.0-only
import { blockCopy } from "./blockCopy.js";
import { loc_2073 } from "./names.js";

// Copy the 11-byte object strip from the shared buffer back into the caller's destination.
export function loc_055b(m, hl = m.regs.hl) {
  blockCopy(m, loc_2073, hl, 0x0b);
}
