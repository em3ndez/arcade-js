// SPDX-License-Identifier: GPL-3.0-only
/** requestTwoSounds — request two sounds in a row, both admitted while a game is in progress or while the
 * cabinet may sound during its attract loop. Neither code is an immediate: each is fetched from
 * its own byte of the program image, and the two bytes are far apart, so this is a pair chosen
 * here and not a run walked through. LIVE-OUT: memory. */

import { enqueueSoundIfGameOrAttract } from "./enqueueSoundIfGameOrAttract.js";

const FIRST_SOUND_CODE_CELL = 0x07a6;
const SECOND_SOUND_CODE_CELL = 0x4cda;

export function requestTwoSounds(m) {
  const { mem8 } = m;
  enqueueSoundIfGameOrAttract(m, mem8[FIRST_SOUND_CODE_CELL]);
  enqueueSoundIfGameOrAttract(m, mem8[SECOND_SOUND_CODE_CELL]);
}
