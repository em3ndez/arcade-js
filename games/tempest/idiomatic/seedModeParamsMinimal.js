// SPDX-License-Identifier: GPL-3.0-only
import { GAME_MODE, MODE_DISPATCH_SEL, GAME_MODE_PENDING, MODE_DELAY_TIMER } from "./names.js";

// Seed four config cells with fixed constants for the next state.
export function seedModeParamsMinimal(m) {
  const { mem8 } = m;
  mem8[GAME_MODE_PENDING] = 0x04;
  mem8[MODE_DISPATCH_SEL] = 0x00;
  mem8[GAME_MODE] = 0x0a;
  mem8[MODE_DELAY_TIMER] = 0x14;
}
