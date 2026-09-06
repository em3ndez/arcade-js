// SPDX-License-Identifier: GPL-3.0-only
// Sequence-init reset: zero the flag block, clear two status bytes, arm the mid-tier dwell timer,
// then advance the sequence state and reseed the strided object-shadow field.
import { fillMemoryBlock } from "./fillMemoryBlock.js";
import { advanceSequenceStateAndReseedObjectShadow } from "./advanceSequenceStateAndReseedObjectShadow.js";
import { FLAG_BITS_BASE, FRAME_COUNTER, OBJECT_DRAW_SUPPRESS, loc_4009 } from "./names.js";

const FLAG_BLOCK_SIZE = 128;
const DWELL_RELOAD = 64;

export function clearFlagBlockAndReseedObjectShadow(m) {
  const { mem8 } = m;

  fillMemoryBlock(m, FLAG_BITS_BASE, 0, FLAG_BLOCK_SIZE);
  mem8[FRAME_COUNTER] = 0;
  mem8[OBJECT_DRAW_SUPPRESS] = 0;
  mem8[loc_4009] = DWELL_RELOAD;

  advanceSequenceStateAndReseedObjectShadow(m, loc_4009);
}
