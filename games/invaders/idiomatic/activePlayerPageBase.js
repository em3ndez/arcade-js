// SPDX-License-Identifier: GPL-3.0-only
import { ACTIVE_PLAYER_PAGE } from "./names.js";

// Point HL at the top of the memory page named by the current-page byte. Live-out: HL.
export function activePlayerPageBase(m) {
  return (m.regs.hl = m.mem8[ACTIVE_PLAYER_PAGE] << 8);
}
