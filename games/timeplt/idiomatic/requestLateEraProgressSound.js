// SPDX-License-Identifier: GPL-3.0-only
/** requestLateEraProgressSound — request one particular sound, and only while a game is in progress. Its code is
 * fetched from a byte of the program image. LIVE-OUT: memory. */

import { enqueueSoundIfGameInProgress } from "./enqueueSoundIfGameInProgress.js";
import { LATE_ERA_PROGRESS_SOUND } from "./names.js";

export function requestLateEraProgressSound(m) {
  enqueueSoundIfGameInProgress(m, m.mem8[LATE_ERA_PROGRESS_SOUND]);
}
