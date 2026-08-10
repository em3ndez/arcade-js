// SPDX-License-Identifier: GPL-3.0-only
/** freeAllShotSlots — clear the six-slot shot record array, zeroing each slot's first and fifth bytes. Fill byte
 * and slot stride are read from program space (on this image fill=0, stride=16). LIVE-OUT: memory + the record cursor past the last slot. */

import { u16 } from "../../../core/int.js";
import { PLAYER_SHOT_ARRAY } from "./names.js";

const SLOTS = 6;
const SECOND_CLEARED_BYTE = 4;

/** Two program-space bytes: the low half of the stride, and the fill that is also its high half. */
const STRIDE_LOW_SOURCE = 0x0861;
const FILL_SOURCE = 0x5c01;

export function freeAllShotSlots(m) {
  const { regs, mem8 } = m;
  const fill = mem8[FILL_SOURCE];
  const stride = mem8[STRIDE_LOW_SOURCE] | (fill << 8);

  let slot = PLAYER_SHOT_ARRAY;
  for (let i = 0; i < SLOTS; i++) {
    mem8[slot] = fill;
    mem8[u16(slot + SECOND_CLEARED_BYTE)] = fill;
    slot = u16(slot + stride);
  }
  regs.ix = slot;
}
