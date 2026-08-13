// SPDX-License-Identifier: GPL-3.0-only
/** requestCoinSound — request one sound, with no permission test: it sounds whether or not a game runs.
 * Its code is fetched from a byte of the program image. LIVE-OUT: memory. */

import { enqueueSoundUnconditional } from "./enqueueSoundUnconditional.js";
import { loc_322e } from "./names.js";

export function requestCoinSound(m) {
  enqueueSoundUnconditional(m, m.mem8[loc_322e]);
}
