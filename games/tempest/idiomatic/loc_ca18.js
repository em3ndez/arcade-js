// SPDX-License-Identifier: GPL-3.0-only
import { STATUS_FLAGS, ACTIVE_SLOT_COUNT, GAME_MODE_PENDING, GAME_MODE, MODE_DELAY_TIMER, MODE_DELAY_GUARD, MODE_DISPATCH_SEL } from "./names.js";

// Mask one cell to its low six bits, then write a block of fixed init constants.
export function loc_ca18(m) {
  const { mem8 } = m;
  mem8[STATUS_FLAGS] = mem8[STATUS_FLAGS] & 0x3f; // keep only the low six bits
  mem8[ACTIVE_SLOT_COUNT] = 0x00;
  mem8[GAME_MODE_PENDING] = 0x1a;
  mem8[GAME_MODE] = 0x0a;
  mem8[MODE_DELAY_TIMER] = 0xa0;
  mem8[MODE_DELAY_GUARD] = 0x01;
  mem8[MODE_DISPATCH_SEL] = 0x0a;
}
