// SPDX-License-Identifier: GPL-3.0-only
import { ACTIVE_PLAYER_PAGE, PLAYER1_OBJ_DESC, PLAYER2_OBJ_DESC } from "./names.js";

// Select the active player's data pointer from bit0 of the flag cell.
export function currentPlayerRecordPtr(m) {
  return (m.regs.hl = (m.mem8[ACTIVE_PLAYER_PAGE] & 1) ? PLAYER1_OBJ_DESC : PLAYER2_OBJ_DESC);
}
