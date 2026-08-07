// SPDX-License-Identifier: GPL-3.0-only
/** freeAllShotSlots — clear a six-slot record array, zeroing each slot's first byte and its fifth.
 * Neither the fill byte nor the stride between slots is written here as a constant: both are
 * read out of program space, one byte apiece, so patching either of those two bytes changes what
 * this writes and where. On the image this runs against the fill is zero and the stride is
 * sixteen, which is the array's own slot width. LIVE-OUT: memory, plus the record cursor left
 * one stride past the last slot. */

import { u16 } from "../../../core/int.js";

const SLOT_ARRAY = 0xaa80;
const SLOTS = 6;
const SECOND_CLEARED_BYTE = 4;

/** Two program-space bytes: the low half of the stride, and the fill that is also its high half. */
const STRIDE_LOW_SOURCE = 0x0861;
const FILL_SOURCE = 0x5c01;

export function freeAllShotSlots(m) {
  const { regs, mem8 } = m;
  const fill = mem8[FILL_SOURCE];
  const stride = mem8[STRIDE_LOW_SOURCE] | (fill << 8);

  let slot = SLOT_ARRAY;
  for (let i = 0; i < SLOTS; i++) {
    mem8[slot] = fill;
    mem8[u16(slot + SECOND_CLEARED_BYTE)] = fill;
    slot = u16(slot + stride);
  }
  regs.ix = slot;
}
