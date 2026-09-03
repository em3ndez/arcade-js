// SPDX-License-Identifier: GPL-3.0-only
import { blockCopy } from "./blockCopy.js";
import { loc_1b83 } from "./names.js";

// Copy B bytes from the fixed template into the caller's destination record at HL.
export function copyTemplateToRecord(m, hl = m.regs.hl, b = m.regs.b) {
  blockCopy(m, loc_1b83, hl, b);
}
