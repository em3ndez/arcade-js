// SPDX-License-Identifier: GPL-3.0-only
/** placeAbuttingTile — carry an object onto one more sprite entry, flush against the one it already
 * occupies. The current entry's two coordinate bytes are read; the entry one stride on takes one
 * of them advanced by a sprite's pitch, truncated to a byte, and the other copied unchanged.
 * Both cursors then step onto the entry just written, so a caller can chain a further one.
 *
 * ROM 0x3058-0x3069 (frozen lift translated/loc_3058.js), ending in a tail jump to advanceToNextSlot
 * at 0x309B. Grounding: [seen] (names.js ROUTINES 0x3058).
 *
 * Role in the machine: builds scenery wider than one sprite. Only a scenery object's first tile
 * drifts with the world; each further tile is positioned from the tile before it — the same native
 * X, native Y plus 16, one sprite's width (mechanisms.md). driftThreeTileSceneryAtFiveQuarters
 * chains two of these to lay a strip; driftNearestSceneryTriTile chains one plus the diagonal
 * sibling placeDiagonallyAbuttingTile to lay a cornered three-tile shape.
 *
 * Sprite entries: the table at 0xAA10 holds each sprite's two-byte entry — a coordinate byte at +0
 * and the shape code at +1 — and a second table 0x30 bytes further on holds the attribute at +0x30
 * and the other coordinate at +0x31. Adjacent slots' entries are two bytes apart in both.
 *
 * Parameters (and their ROM registers): `entry` the current tile's sprite entry (IY); `record` the
 * matching object-record cursor (IX), stepped alongside.
 *
 * LIVE-OUT: the two bytes written, and the two stepped cursors. */

import { advanceToNextSlot } from "./advanceToNextSlot.js";

// One slot on in the sprite-entry tables.
const ENTRY_STRIDE = 2;
// One sprite's width: 16 pixels (the ROM's `ld a,0x10`).
const SPRITE_PITCH = 16;
// The coordinate stepped lives at +0x31 of an entry, the one copied at +0x00.
const STEPPED_COORDINATE = 49;
const COPIED_COORDINATE = 0;

export function placeAbuttingTile(m, entry = m.regs.iy, record = m.regs.ix) {
  const { mem8 } = m;
  const nextEntry = entry + ENTRY_STRIDE;

  // ROM `ld b,(iy+0x31) / ld c,(iy+0x00) / ld a,0x10 / add a,b / ld (iy+0x33),a / ld (iy+0x02),c`:
  // the next entry's +0x31 coordinate is this one's plus a sprite's pitch (an 8-bit add, so it
  // wraps within the byte), and its +0x00 coordinate is copied across unchanged.
  mem8[nextEntry + STEPPED_COORDINATE] = mem8[entry + STEPPED_COORDINATE] + SPRITE_PITCH;
  mem8[nextEntry + COPIED_COORDINATE] = mem8[entry + COPIED_COORDINATE];
  // Step from the slot this tile was placed on, so a seeded first call advances from the seed
  // rather than from stale cursors.
  // (ROM `jp 0x309b`: the tail into advanceToNextSlot, which adds 16 to the record cursor and 2 to
  // the entry cursor, so both now name the tile just written.)
  return advanceToNextSlot(m, record, entry);
}
