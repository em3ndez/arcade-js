// SPDX-License-Identifier: GPL-3.0-only
import { loc_1c9 } from "./names.js";

// Set the low two request flags in a working flags cell and return the merged value.
export function loc_ac36(m) {
  const { mem8 } = m;
  const value = mem8[loc_1c9] | 0x03;
  mem8[loc_1c9] = value;
  return (m.regs.a = value);
}
