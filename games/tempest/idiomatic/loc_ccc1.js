// SPDX-License-Identifier: GPL-3.0-only
import { requestSoundIfEnabled } from "./requestSoundIfEnabled.js";

// Trampoline: gate-register the fixed sound id 0x1f, carrying the caller's X/Y.
export function loc_ccc1(m, x = m.regs.x, y = m.regs.y) {
  return requestSoundIfEnabled(m, 0x1f, x, y);
}
