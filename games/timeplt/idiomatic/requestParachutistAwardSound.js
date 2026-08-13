// SPDX-License-Identifier: GPL-3.0-only
/** requestParachutistAwardSound — request one particular sound, and only while a game is in progress. Its code is
 * fetched from a byte of the program image. LIVE-OUT: memory. */

import { enqueueSoundIfGameInProgress } from "./enqueueSoundIfGameInProgress.js";
import { PARACHUTIST_AWARD_SOUND } from "./names.js";

export function requestParachutistAwardSound(m) {
  enqueueSoundIfGameInProgress(m, m.mem8[PARACHUTIST_AWARD_SOUND]);
}
