// SPDX-License-Identifier: GPL-3.0-only
import { clearScreenStrip } from "./clearScreenStrip.js";
import { TWO_PLAYER_GAME, loc_391c } from "./names.js";

// Blank a fixed screen strip, unless the mode-guard cell is already set.
export function blankScreenStrip(m) {
  if (m.mem8[TWO_PLAYER_GAME] !== 0) return;
  return clearScreenStrip(m, 0x20, loc_391c);
}
