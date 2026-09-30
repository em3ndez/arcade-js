// SPDX-License-Identifier: GPL-3.0-only
/** requestObjectState3bSound — request one particular sound, and only while a game is in progress. Its code is
 * not an immediate: it is fetched from a byte of the program image. LIVE-OUT: memory. */

import { enqueueSoundIfGameInProgress } from "./enqueueSoundIfGameInProgress.js";
import { OBJECT_STATE_3B_SOUND } from "./names.js";

export function requestObjectState3bSound(m) {
  enqueueSoundIfGameInProgress(m, m.mem8[OBJECT_STATE_3B_SOUND]);
}
