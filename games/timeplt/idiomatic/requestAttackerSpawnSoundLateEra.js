// SPDX-License-Identifier: GPL-3.0-only
/** requestAttackerSpawnSoundLateEra — request one particular sound, and only while a game is in progress. Its code is
 * fetched from a byte of the program image. LIVE-OUT: memory. */

import { enqueueSoundIfGameInProgress } from "./enqueueSoundIfGameInProgress.js";
import { ATTACKER_SPAWN_SOUND_LATE_ERA } from "./names.js";

export function requestAttackerSpawnSoundLateEra(m) {
  enqueueSoundIfGameInProgress(m, m.mem8[ATTACKER_SPAWN_SOUND_LATE_ERA]);
}
