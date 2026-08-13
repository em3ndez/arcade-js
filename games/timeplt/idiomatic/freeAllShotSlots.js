// SPDX-License-Identifier: GPL-3.0-only
/** freeAllShotSlots — clear the six-slot shot record array, zeroing each slot's first and fifth bytes. Fill byte
 * and slot stride are read from program space (on this image fill=0, stride=16). LIVE-OUT: memory + the record cursor past the last slot. */

import { u16 } from "../../../core/int.js";
import { PLAYER_SHOT_ARRAY, PLAYER_SHOT_SLOT_STRIDE, loc_5c01 } from "./names.js";

const SLOTS = 6;
const SECOND_CLEARED_BYTE = 4;

// Two program-space bytes: the fill (also the stride's high half) and the stride's low half.
export function freeAllShotSlots(m) {
  const { regs, mem8 } = m;
  const fill = mem8[loc_5c01];
  const stride = mem8[PLAYER_SHOT_SLOT_STRIDE] | (fill << 8);

  let slot = PLAYER_SHOT_ARRAY;
  for (let i = 0; i < SLOTS; i++) {
    mem8[slot] = fill;
    mem8[u16(slot + SECOND_CLEARED_BYTE)] = fill;
    slot = u16(slot + stride);
  }
  regs.ix = slot;
}
