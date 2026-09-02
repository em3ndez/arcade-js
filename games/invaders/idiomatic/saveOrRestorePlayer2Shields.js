// SPDX-License-Identifier: GPL-3.0-only
import { drawOrSaveShields } from "./drawOrSaveShields.js";
import { PLAYER2_SHIELD_BUFFER } from "./names.js";

// Seat the player-2 shield source/dest base, then save-or-draw the four shield blocks under the caller's mode flag.
export function saveOrRestorePlayer2Shields(m, a = m.regs.a) {
  drawOrSaveShields(m, a, PLAYER2_SHIELD_BUFFER);
}
