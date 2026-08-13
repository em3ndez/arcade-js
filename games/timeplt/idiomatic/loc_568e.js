// SPDX-License-Identifier: GPL-3.0-only
/** loc_568e — request one particular sound, and only while a game is in progress. Its code is
 * not an immediate: it is fetched from a byte of the program image. LIVE-OUT: memory. */

import { enqueueSoundIfGameInProgress } from "./enqueueSoundIfGameInProgress.js";
import { loc_2d87 } from "./names.js";

export function loc_568e(m) {
  enqueueSoundIfGameInProgress(m, m.mem8[loc_2d87]);
}
