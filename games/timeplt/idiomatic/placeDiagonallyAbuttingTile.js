// SPDX-License-Identifier: GPL-3.0-only
/** placeDiagonallyAbuttingTile — carry an object diagonally onto one more sprite entry, cornering off the one it
 * already occupies. The current entry's two coordinate bytes are read as a single sixteen-bit
 * number, moved a sprite's pitch BACK along the axis held in the high half and a pitch ON along
 * the axis in the low half, and written to the entry one stride further up — so a wrap on the
 * low axis carries into the high one instead of being dropped. Both cursors then step onto the
 * entry just written, so a caller can chain a further tile from it.
 * LIVE-OUT: the two bytes written, and the two stepped cursors. */

import { u16 } from "../../../core/int.js";
import { advanceToNextSlot } from "./advanceToNextSlot.js";

const ENTRY_STRIDE = 2;
const SPRITE_PITCH = 16;
const HIGH_AXIS = 49;
const LOW_AXIS = 0;
const DIAGONAL_STEP = -SPRITE_PITCH * 256 + SPRITE_PITCH;

export function placeDiagonallyAbuttingTile(m) {
  const { mem8, regs } = m;
  const entry = regs.iy;
  const nextEntry = entry + ENTRY_STRIDE;

  const moved = u16((mem8[entry + HIGH_AXIS] << 8) + mem8[entry + LOW_AXIS] + DIAGONAL_STEP);
  mem8[nextEntry + HIGH_AXIS] = moved >> 8;
  mem8[nextEntry + LOW_AXIS] = moved;
  advanceToNextSlot(m);
}
