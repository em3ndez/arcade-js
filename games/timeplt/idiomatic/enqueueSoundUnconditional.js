// SPDX-License-Identifier: GPL-3.0-only
/** enqueueSoundUnconditional — request a sound with no permission test at all: the code is queued whether or not
 * a game is being played. LIVE-OUT: memory. */

import { appendSoundCommandToQueue } from "./appendSoundCommandToQueue.js";

export function enqueueSoundUnconditional(m, command = m.regs.a) {
  appendSoundCommandToQueue(m, command);
}
