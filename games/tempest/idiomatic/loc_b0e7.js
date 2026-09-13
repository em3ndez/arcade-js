// SPDX-License-Identifier: GPL-3.0-only
import { GAME_MODE, MODE_DISPATCH_SEL, GAME_MODE_PENDING, MODE_DELAY_TIMER, loc_14d, loc_14e } from "./names.js";

// Seed six work-RAM cells with fixed startup constants.
export function loc_b0e7(m) {
  const { mem8 } = m;
  mem8[GAME_MODE] = 0x0a;
  mem8[GAME_MODE_PENDING] = 0x00;
  mem8[MODE_DELAY_TIMER] = 0xdf;
  mem8[MODE_DISPATCH_SEL] = 0x12;
  mem8[loc_14e] = 0x19;
  mem8[loc_14d] = 0x18;
  return;
}
