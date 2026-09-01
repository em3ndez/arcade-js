// SPDX-License-Identifier: GPL-3.0-only
import { ACTIVE_PLAYER_PAGE, loc_20e7 } from "./names.js";

// Select one of two adjacent pointer cells by the player-select bit0. Value-out: HL.
export function loc_1910(m) {
  return (m.regs.hl = (m.mem8[ACTIVE_PLAYER_PAGE] & 1) ? loc_20e7 : loc_20e7 + 1);
}
