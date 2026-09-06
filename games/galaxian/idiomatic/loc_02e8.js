// SPDX-License-Identifier: GPL-3.0-only
// Sequence-init reset: zero the flag block, clear two status bytes, arm the mid-tier dwell timer,
// then advance the sequence state and reseed the strided object-shadow field.
import { fillMemoryBlock } from "./fillMemoryBlock.js";
import { advanceSequenceStateAndReseedObjectShadow } from "./advanceSequenceStateAndReseedObjectShadow.js";
import { FLAG_BITS_BASE, loc_425f, loc_4238, loc_4009 } from "./names.js";

const FLAG_BLOCK_SIZE = 128;
const DWELL_RELOAD = 64;

export function loc_02e8(m) {
  const { mem8 } = m;

  fillMemoryBlock(m, FLAG_BITS_BASE, 0, FLAG_BLOCK_SIZE);
  mem8[loc_425f] = 0;
  mem8[loc_4238] = 0;
  mem8[loc_4009] = DWELL_RELOAD;

  advanceSequenceStateAndReseedObjectShadow(m, loc_4009);
}
