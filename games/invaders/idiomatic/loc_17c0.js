// SPDX-License-Identifier: GPL-3.0-only
import { loc_2067 } from "./names.js";

// The low bit of the input-select flag picks the port: set reads player 1, clear reads player 2.
export function loc_17c0(m) {
  return (m.regs.a = m.io.portIn(m.mem8[loc_2067] & 0x01 ? 0x01 : 0x02));
}
