// SPDX-License-Identifier: GPL-3.0-only
import { saveOrRestorePlayer2Shields } from "./saveOrRestorePlayer2Shields.js";

// Restore the player-2 shields: force the mode flag clear, then run the shared shield-draw body.
export function loc_0213(m) {
  saveOrRestorePlayer2Shields(m, 0);
}
