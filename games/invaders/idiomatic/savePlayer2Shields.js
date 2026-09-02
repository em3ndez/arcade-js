// SPDX-License-Identifier: GPL-3.0-only
import { saveOrRestorePlayer2Shields } from "./saveOrRestorePlayer2Shields.js";

// Save the player-2 shield region into its backup buffer.
export function savePlayer2Shields(m) {
  saveOrRestorePlayer2Shields(m, 1);
}
