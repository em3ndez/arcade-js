// SPDX-License-Identifier: GPL-3.0-only
import { saveOrRestorePlayer1Shields } from "./saveOrRestorePlayer1Shields.js";

// Restore the player-1 shields: force the mode flag clear, then run the shared shield-draw body.
export function loc_021a(m) {
  return saveOrRestorePlayer1Shields(m, 0);
}
