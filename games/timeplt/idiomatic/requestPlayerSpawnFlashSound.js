// SPDX-License-Identifier: GPL-3.0-only
/** requestPlayerSpawnFlashSound — request one particular sound, and only while a game is in progress. Its code is
 * fetched from a byte of the program image. LIVE-OUT: memory. */

import { enqueueSoundIfGameInProgress } from "./enqueueSoundIfGameInProgress.js";
import { PLAYER_SPAWN_FLASH_SOUND } from "./names.js";

export function requestPlayerSpawnFlashSound(m) {
  enqueueSoundIfGameInProgress(m, m.mem8[PLAYER_SPAWN_FLASH_SOUND]);
}
