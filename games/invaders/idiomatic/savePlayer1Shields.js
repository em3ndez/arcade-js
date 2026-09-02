// SPDX-License-Identifier: GPL-3.0-only
import { saveOrRestorePlayer1Shields } from "./saveOrRestorePlayer1Shields.js";

// Save the player-1 shield region into its backup buffer.
export function savePlayer1Shields(m) {
  saveOrRestorePlayer1Shields(m, 1);
}
