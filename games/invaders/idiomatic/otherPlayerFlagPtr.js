// SPDX-License-Identifier: GPL-3.0-only
import { ACTIVE_PLAYER_PAGE, loc_20e7 } from "./names.js";

// Point HL one past the base cell when bit0 of the select byte is set. Live-out: HL; seam completes the ret.
export function otherPlayerFlagPtr(m) {
  return (m.regs.hl = loc_20e7 + (m.mem8[ACTIVE_PLAYER_PAGE] & 1));
}
