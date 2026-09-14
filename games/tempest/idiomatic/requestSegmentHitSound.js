// SPDX-License-Identifier: GPL-3.0-only
import { requestSoundIfEnabled } from "./requestSoundIfEnabled.js";

// Trampoline: register the fixed sound id 0x9f through the enable gate.
export function requestSegmentHitSound(m, x = m.regs.x, y = m.regs.y) {
  requestSoundIfEnabled(m, 0x9f, x, y);
}
