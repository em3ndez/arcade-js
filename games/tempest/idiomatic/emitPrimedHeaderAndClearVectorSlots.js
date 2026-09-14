// SPDX-License-Identifier: GPL-3.0-only
import { emitVectorHeaderAndClearSlots } from "./emitVectorHeaderAndClearSlots.js";

// Run the vector-block clear with its value/index pair primed. The primed value
// is always nonzero, so the alternate self-seeding entry is never reached.
export function emitPrimedHeaderAndClearVectorSlots(m) {
  return emitVectorHeaderAndClearSlots(m, 0x32, 0xb6);
}
