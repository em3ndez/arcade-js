// SPDX-License-Identifier: GPL-3.0-only
import { requestSoundIfEnabled } from "./requestSoundIfEnabled.js";

// Trampoline: raise the fixed sound id and run the sound gate, threading X/Y to the cue.
export function loc_cd06(m, x = m.regs.x, y = m.regs.y) {
  requestSoundIfEnabled(m, 0xcf, x, y);
}
