// SPDX-License-Identifier: GPL-3.0-only
/** requestRoundIntroSoundBurst — ask for a burst of sounds in one go. Three codes are fetched from bytes of the
 * program image and offered one after another to the in-play permission test, so all three are
 * dropped together whenever a game is not running; the entry then runs straight on into a further
 * pair of requests, which decide for themselves whether they may be heard. Nothing arrives from
 * the caller: the choice of codes is the whole content here. LIVE-OUT: memory. */

import { enqueueSoundIfGameInProgress } from "./enqueueSoundIfGameInProgress.js";
import { requestInterRoundSoundPair } from "./requestInterRoundSoundPair.js";
import { ROUND_INTRO_SOUND_1, ROUND_INTRO_SOUND_2, ROUND_INTRO_SOUND_3 } from "./names.js";

export function requestRoundIntroSoundBurst(m) {
  const { mem8 } = m;
  enqueueSoundIfGameInProgress(m, mem8[ROUND_INTRO_SOUND_1]);
  enqueueSoundIfGameInProgress(m, mem8[ROUND_INTRO_SOUND_2]);
  enqueueSoundIfGameInProgress(m, mem8[ROUND_INTRO_SOUND_3]);
  requestInterRoundSoundPair(m);
}
