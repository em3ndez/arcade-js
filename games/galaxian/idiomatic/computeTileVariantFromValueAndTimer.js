// SPDX-License-Identifier: GPL-3.0-only
// Bias a tile-variant value by the frame counter's low nibble: values at or above the range limit
// saturate to the out-of-range marker; otherwise take the low nibble, set a carry when the counter's
// low nibble is smaller, and fold to a 2-bit variant index. Result is register B.
import { computeTileVariantFromTimer } from "./computeTileVariantFromTimer.js";
import { FRAME_COUNTER } from "./names.js";

const RANGE_LIMIT = 112;  // values at or above this saturate
const OUT_OF_RANGE = 128; // saturation marker

export function computeTileVariantFromValueAndTimer(m, value = m.regs.b) {
  const { mem8 } = m;

  if (value >= RANGE_LIMIT) return (m.regs.b = OUT_OF_RANGE);

  const low = value & 0x0f;
  const carryIn = (mem8[FRAME_COUNTER] & 0x0f) < low ? 0xff : 0;
  return computeTileVariantFromTimer(m, low, carryIn);
}
