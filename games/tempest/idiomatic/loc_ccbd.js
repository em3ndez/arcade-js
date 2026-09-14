// SPDX-License-Identifier: GPL-3.0-only
import { requestSoundIfEnabled } from "./requestSoundIfEnabled.js";

// Trampoline: gate-register the fixed sound id 0x8f, carrying the caller's X/Y.
export function loc_ccbd(m, x = m.regs.x, y = m.regs.y) {
  requestSoundIfEnabled(m, 0x8f, x, y);
}
