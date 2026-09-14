// SPDX-License-Identifier: GPL-3.0-only
import { requestSoundIfEnabled } from "./requestSoundIfEnabled.js";

// Trampoline: register the fixed sound id 0x6f through the enable gate.
export function loc_ccee(m, x = m.regs.x, y = m.regs.y) {
  requestSoundIfEnabled(m, 0x6f, x, y);
}
