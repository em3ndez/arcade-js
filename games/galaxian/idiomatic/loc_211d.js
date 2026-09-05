// SPDX-License-Identifier: GPL-3.0-only
// Fold B into a 2-bit value: when B is below the range limit, B = (swap-nibbles(status byte) + B + C) & 3;
// otherwise saturate B to the out-of-range marker. A and the flags are left unchanged.
import { loc_425f } from "./names.js";
import { markValueOutOfRange } from "./markValueOutOfRange.js";

const RANGE_LIMIT = 112; // B at or above this saturates instead of folding

export function loc_211d(m, value = m.regs.b, carryIn = m.regs.c) {
  const { mem8 } = m;

  // Out of range: saturate.
  if (value >= RANGE_LIMIT) return markValueOutOfRange(m);

  // In range: swap the status byte's nibbles, add B and C, keep the low two bits.
  const status = mem8[loc_425f];
  const swapped = ((status >> 4) | (status << 4)) & 0xff;
  return (m.regs.b = (swapped + value + carryIn) & 0x03);
}
