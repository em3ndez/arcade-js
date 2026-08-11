// SPDX-License-Identifier: GPL-3.0-only
/** requestCoinSound — request one sound, with no permission test: it sounds whether or not a game runs.
 * Its code is fetched from a byte of the program image. LIVE-OUT: memory. */

import { enqueueSoundUnconditional } from "./enqueueSoundUnconditional.js";

const SOUND_CODE_CELL = 0x322e;

export function requestCoinSound(m) {
  enqueueSoundUnconditional(m, m.mem8[SOUND_CODE_CELL]);
}
