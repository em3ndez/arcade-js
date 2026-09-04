// SPDX-License-Identifier: GPL-3.0-only
import { ALIEN_COUNT } from "./names.js";

// B is 2, or 3 when the select byte reads exactly 1. Live-out: B; seam completes the ret.
export function fleetStepSize(m) {
  return (m.regs.b = m.mem8[ALIEN_COUNT] === 1 ? 3 : 2);
}
