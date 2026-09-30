// SPDX-License-Identifier: GPL-3.0-only
/** placeDiagonallyAbuttingTile — carry an object diagonally onto one more sprite entry, cornering off the one it
 * already occupies. The current entry's two coordinate bytes are read as a single sixteen-bit
 * number, moved a sprite's pitch BACK along the axis held in the high half and a pitch ON along
 * the axis in the low half, and written to the entry one stride further up — so a wrap on the
 * low axis carries into the high one instead of being dropped. Both cursors then step onto the
 * entry just written, so a caller can chain a further tile from it.
 *
 * ROM 0x308A-0x309A (frozen lift translated/loc_308a.js). There is no jump at the end: the code runs
 * straight on into advanceToNextSlot, which begins at the next address, 0x309B. Grounding: [seen]
 * (names.js ROUTINES 0x308A).
 *
 * Role in the machine: the diagonal sibling of placeAbuttingTile, used in building multi-sprite
 * scenery. driftNearestSceneryTriTile chains placeAbuttingTile and then this one, laying three tiles
 * on three corners of a square — the near scenery object's cornered three-tile shape in eras 1-3
 * (mechanisms.md). The step is -16 on the entry's +0x31 byte and +16 on its +0x00 byte.
 *
 * Sprite entries: the table at 0xAA10 holds a coordinate byte at +0 of each entry, and the table
 * 0x30 bytes further on holds the other coordinate at +0x31. Adjacent slots are two bytes apart.
 *
 * Parameter: `entry` the current tile's sprite entry (IY in the ROM).
 *
 * LIVE-OUT: the two bytes written, and the two stepped cursors. */

import { u16 } from "../../../core/int.js";
import { advanceToNextSlot } from "./advanceToNextSlot.js";

// One slot on in the sprite-entry tables.
const ENTRY_STRIDE = 2;
// One sprite's width: 16 pixels.
const SPRITE_PITCH = 16;
// The coordinate at +0x31 forms the high byte of the pair, the one at +0x00 the low byte.
const HIGH_AXIS = 49;
const LOW_AXIS = 0;
// The ROM's `ld h,0xf0 / ld l,0x10`: the word 0xF010 is -16 in the high byte and +16 in the low,
// added as one 16-bit quantity.
const DIAGONAL_STEP = -SPRITE_PITCH * 256 + SPRITE_PITCH;

export function placeDiagonallyAbuttingTile(m, entry = m.regs.iy) {
  const { mem8 } = m;
  const nextEntry = entry + ENTRY_STRIDE;

  // ROM `ld b,(iy+0x31) / ld c,(iy+0x00)` then `add hl,bc`: one 16-bit add of the step to the pair,
  // so a carry out of the low coordinate moves the high coordinate by one as well.
  const moved = u16((mem8[entry + HIGH_AXIS] << 8) + mem8[entry + LOW_AXIS] + DIAGONAL_STEP);
  // ROM `ld (iy+0x33),h / ld (iy+0x02),l`: the two halves go into the next slot's entry.
  mem8[nextEntry + HIGH_AXIS] = moved >> 8;
  mem8[nextEntry + LOW_AXIS] = moved;
  // The fall-through into 0x309B: advanceToNextSlot steps the record cursor (IX) by 16 and the entry
  // cursor (IY) by 2, onto the tile just written.
  advanceToNextSlot(m);
}
