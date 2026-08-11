// SPDX-License-Identifier: GPL-3.0-only
/** enqueueSoundIfGameInProgress — request a sound only while a game is in progress. One permission cell decides: set,
 * and the code joins the pending-sound queue; clear, and the request is dropped silently and
 * completely, leaving no trace for a later frame to pick up. LIVE-OUT: memory. */

import { appendSoundCommandToQueue } from "./appendSoundCommandToQueue.js";
import { PLAY_ACTIVE } from "./names.js";

export function enqueueSoundIfGameInProgress(m, command = m.regs.a) {
  if (m.mem8[PLAY_ACTIVE] === 0) return;
  appendSoundCommandToQueue(m, command);
}
