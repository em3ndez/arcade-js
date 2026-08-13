// SPDX-License-Identifier: GPL-3.0-only
/** advanceSequenceElseStartFreePlayGame — a shared tail of the sequence machine: on a nonzero credit count, step the outer
 * sequence phase and leave; otherwise, only under free play and while a start button is held, sweep every sprite off the picture and start a game charging no credit. LIVE-OUT: memory. */

import { advanceSequencePhase } from "./advanceSequencePhase.js";
import { hideAllSprites } from "./hideAllSprites.js";
import { startGameOnFreePlay } from "./startGameOnFreePlay.js";
import { CREDIT_COUNT, FREE_PLAY, IN0_MIRROR } from "./names.js";

const START_BUTTONS = 0x18;

export function advanceSequenceElseStartFreePlayGame(m) {
  const { mem8 } = m;
  if (mem8[CREDIT_COUNT] !== 0) return advanceSequencePhase(m);
  if (mem8[FREE_PLAY] === 0) return;
  if ((mem8[IN0_MIRROR] & START_BUTTONS) === 0) return;
  hideAllSprites(m);
  return startGameOnFreePlay(m);
}
