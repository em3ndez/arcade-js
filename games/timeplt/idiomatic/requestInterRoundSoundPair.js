// SPDX-License-Identifier: GPL-3.0-only
/** requestInterRoundSoundPair — request two particular sounds in turn, and only while the cabinet may make them.
 * Neither code is an immediate: each is fetched from a byte of the program image, and choosing
 * that pair is the whole of this entry — whatever a caller held is discarded. Both go through the
 * same permission test, so both can be refused together. LIVE-OUT: memory. */

import { enqueueSoundIfGameOrAttract } from "./enqueueSoundIfGameOrAttract.js";
import { INTER_ROUND_SOUND_1, loc_33a0 } from "./names.js";

export function requestInterRoundSoundPair(m) {
  const { mem8 } = m;
  enqueueSoundIfGameOrAttract(m, mem8[INTER_ROUND_SOUND_1]);
  enqueueSoundIfGameOrAttract(m, mem8[loc_33a0]);
}
