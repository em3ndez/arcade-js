// SPDX-License-Identifier: GPL-3.0-only
/** requestMotherShipWarpSound — request one particular sound, and only while a game is in progress. Its code is
 * fetched from a byte of the program image. LIVE-OUT: memory. */

import { enqueueSoundIfGameInProgress } from "./enqueueSoundIfGameInProgress.js";
import { MOTHER_SHIP_WARP_SOUND } from "./names.js";

export function requestMotherShipWarpSound(m) {
  enqueueSoundIfGameInProgress(m, m.mem8[MOTHER_SHIP_WARP_SOUND]);
}
