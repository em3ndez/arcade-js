// SPDX-License-Identifier: GPL-3.0-only
import { PENDING_WORK_FLAGS } from "./names.js";

// Set the low two request flags in a working flags cell and return the merged value.
export function raiseRebuildRequestBits(m) {
  const { mem8 } = m;
  const value = mem8[PENDING_WORK_FLAGS] | 0x03;
  mem8[PENDING_WORK_FLAGS] = value;
  return (m.regs.a = value);
}
