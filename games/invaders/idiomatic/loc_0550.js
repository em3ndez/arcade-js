// SPDX-License-Identifier: GPL-3.0-only
import { blockCopy } from "./blockCopy.js";
import { loc_2073, loc_207f } from "./names.js";

// Stash A, then copy the 11-byte object strip from the caller's source into the shared buffer.
export function loc_0550(m, a = m.regs.a, de = m.regs.de) {
  m.mem8[loc_207f] = a;
  blockCopy(m, de, loc_2073, 0x0b);
}
