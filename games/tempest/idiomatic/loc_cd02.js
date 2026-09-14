// SPDX-License-Identifier: GPL-3.0-only
import { requestSoundIfEnabled } from "./requestSoundIfEnabled.js";

// Trampoline: register the fixed sound id 0x3f through the enable gate, threading X to the cue.
export function loc_cd02(m, x = m.regs.x) {
  requestSoundIfEnabled(m, 0x3f, x);
}
