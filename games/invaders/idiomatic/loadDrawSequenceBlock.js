// SPDX-License-Identifier: GPL-3.0-only
import { blockCopy } from "./blockCopy.js";
import { loc_20c2 } from "./names.js";

// Copy the 12-byte block from the caller's source into its fixed work-RAM slot.
export function loadDrawSequenceBlock(m, de = m.regs.de) {
  blockCopy(m, de, loc_20c2, 0x0c);
}
