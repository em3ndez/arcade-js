// SPDX-License-Identifier: GPL-3.0-only
/** requestAttackerSpawnSoundLateEra — request one particular sound, and only while a game is in progress. Its code is
 * fetched from a byte of the program image. LIVE-OUT: memory. */

import { enqueueSoundIfGameInProgress } from "./enqueueSoundIfGameInProgress.js";

const SOUND_CODE_CELL = 0x276b;

export function requestAttackerSpawnSoundLateEra(m) {
  enqueueSoundIfGameInProgress(m, m.mem8[SOUND_CODE_CELL]);
}
