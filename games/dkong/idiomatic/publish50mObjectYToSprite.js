// SPDX-License-Identifier: GPL-3.0-only
/**
 * publish50mObjectYToSprite — copy the byte at srcAddr into the +3 (Y) field of one of two
 * adjacent sprite records (17 and 18), selected by bit 3 of srcAddr's low byte.
 *
 * LIVE-OUT: memory-only — the single store. The source pointer is left untouched.
 */

import { SPRITE_BUFFER } from "./names.js";

const DEST_BIT3_CLEAR = SPRITE_BUFFER + 17 * 4 + 3;
const DEST_BIT3_SET = SPRITE_BUFFER + 18 * 4 + 3;

export function publish50mObjectYToSprite(m, srcAddr) {
  const { mem8 } = m;

  const value = mem8[srcAddr];
  const dest = (srcAddr & 0x08) !== 0 ? DEST_BIT3_SET : DEST_BIT3_CLEAR;
  mem8[dest] = value;
}
