// SPDX-License-Identifier: GPL-3.0-only
/** enqueueSoundIfGameOrAttract — request a sound while a game is in progress, OR while the cabinet is set to make
 * sound during its attract loop. Two permission cells, tested in that order, and either one on
 * its own is enough; only with both clear is the request dropped. LIVE-OUT: memory. */

import { appendSoundCommandToQueue } from "./appendSoundCommandToQueue.js";
import { DEMO_SOUNDS_ENABLE, PLAY_ACTIVE } from "./names.js";


export function enqueueSoundIfGameOrAttract(m, command = m.regs.a) {
  const { mem8 } = m;
  if (mem8[PLAY_ACTIVE] === 0 && mem8[DEMO_SOUNDS_ENABLE] === 0) return;
  appendSoundCommandToQueue(m, command);
}
