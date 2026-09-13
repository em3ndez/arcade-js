// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { GAME_MODE, STATUS_FLAGS, ACTIVE_SLOT_COUNT, PLAYER_LEVEL_TBL, WAVE_PEAK_SEED } from "./names.js";

// Find the largest byte in a zero-page window whose length is set by a cursor,
// store it decremented once when nonzero, then set one cell to 0x14 or (when a
// status byte is negative) 0x10.
export function loc_c9f1(m) {
  const { mem8 } = m;
  let max = 0;
  let x = mem8[ACTIVE_SLOT_COUNT];
  for (;;) {
    const v = mem8[u8(PLAYER_LEVEL_TBL + x)];
    if (v >= max) max = v;
    if (x === 0) break;
    x = u8(x - 1);
  }
  mem8[WAVE_PEAK_SEED] = max === 0 ? 0 : (max - 1) & 0xff;
  mem8[GAME_MODE] = (mem8[STATUS_FLAGS] & 0x80) ? 0x10 : 0x14;
}
