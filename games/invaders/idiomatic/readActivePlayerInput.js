// SPDX-License-Identifier: GPL-3.0-only
import { ACTIVE_PLAYER_PAGE } from "./names.js";

// The low bit of the input-select flag picks the port: set reads player 1, clear reads player 2.
export function readActivePlayerInput(m) {
  return (m.regs.a = m.io.portIn(m.mem8[ACTIVE_PLAYER_PAGE] & 0x01 ? 0x01 : 0x02));
}
