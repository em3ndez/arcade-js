// SPDX-License-Identifier: GPL-3.0-only
import { drawOrSaveShields } from "./drawOrSaveShields.js";
import { PLAYER1_SHIELD_BUFFER } from "./names.js";

// Save or restore the shields against their backup buffer, driven by A as the save/restore mode.
export function saveOrRestorePlayer1Shields(m, a = m.regs.a) {
  return drawOrSaveShields(m, a, PLAYER1_SHIELD_BUFFER);
}
