// SPDX-License-Identifier: GPL-3.0-only
/** requestRoundStartSound — request one particular sound, and only while a game is in progress. Its code is
 * fetched from a byte of the program image. LIVE-OUT: memory. */

import { enqueueSoundIfGameInProgress } from "./enqueueSoundIfGameInProgress.js";
import { loc_1767 } from "./names.js";

export function requestRoundStartSound(m) {
  enqueueSoundIfGameInProgress(m, m.mem8[loc_1767]);
}
