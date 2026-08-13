// SPDX-License-Identifier: GPL-3.0-only
/** requestEnemyLaunchSoundLateEra — request one particular sound, and only while a game is in progress. Its code is
 * fetched from a byte of the program image. LIVE-OUT: memory. */

import { enqueueSoundIfGameInProgress } from "./enqueueSoundIfGameInProgress.js";
import { loc_4c9f } from "./names.js";

export function requestEnemyLaunchSoundLateEra(m) {
  enqueueSoundIfGameInProgress(m, m.mem8[loc_4c9f]);
}
