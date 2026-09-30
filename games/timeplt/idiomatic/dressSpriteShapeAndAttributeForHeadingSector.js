// SPDX-License-Identifier: GPL-3.0-only
/** dressSpriteShapeAndAttributeForHeadingSector — show an object pointing the way it is heading: its heading byte is rounded to one of
 * sixteen sectors, and that sector picks a shape and the byte beside it out of two parallel tables
 * in the program image, sixteen entries apart. The pair goes into the object's sprite entry, the
 * shape in one slot and the other byte in a slot further on. Rounding adds half a sector before
 * taking the top nibble, so a heading is snapped to the NEAREST sector rather than truncated, and
 * that addition wraps, which is what closes the circle of sectors. LIVE-OUT: memory, two bytes.
 *
 * ROM 0x3FAF-0x3FC9 (frozen lift loc_3faf). Grounding: [seen] (names.js ROUTINES 0x3FAF).
 *
 * Role in the machine: an object in Time Pilot is two records side by side — its object record
 * (passed as `object`, IX in the ROM) holding its own state such as the heading at +2, and its
 * sprite entry (passed as `sprite`, IY in the ROM) holding what the video hardware draws: the
 * shape code at +1 and the attribute byte at +0x30. A heading is a full byte, 256 steps round the
 * circle, but the artwork only has sixteen directions, so this routine is the step that turns
 * "which way it flies" into "which picture to show". mechanisms.md groups it with
 * dressSpriteForCoarseHeading: both use sixteen sectors and tables whose attribute half sits
 * sixteen bytes after the shape half, with no flutter.
 *
 * The tables: HEADING_SECTOR_SHAPE_TABLE (0x3FCA) is sixteen shape codes, one per sector, and the
 * sixteen bytes that follow it (from 0x3FDA) are the matching attribute bytes. Both are ROM data.
 *
 * Nothing is returned and nothing in the object record is changed; the only writes are the two
 * sprite-entry bytes.
 */

import { u8, u16 } from "../../../core/int.js";
import { fetchTableByte } from "./fetchTableByte.js";
import { HEADING_SECTOR_SHAPE_TABLE } from "./names.js";

// Byte offsets, all taken from the ROM's indexed loads and stores.
const HEADING_IN_RECORD = 2; // ld a,(ix+0x02): the heading byte in the object record
const SECOND_TABLE_GAP = 16; // ld de,0x0010 / add hl,de: the attribute table starts 16 bytes on
const SHAPE_IN_ENTRY = 1; // ld (iy+0x01),a: the sprite entry's shape byte
const SECOND_BYTE_IN_ENTRY = 48; // ld (iy+0x30),a: the sprite entry's attribute byte
const HALF_SECTOR = 8; // add a,0x08: half of one 16-step sector, so the rounding is to nearest

export function dressSpriteShapeAndAttributeForHeadingSector(m, object = m.regs.ix, sprite = m.regs.iy) {
  const { mem8 } = m;
  /* Heading -> sector. The ROM does `add a,0x08`, four `rrca`s and `and 0x0f`: add half a sector,
   * then keep the top nibble. The add wraps at eight bits (u8), so a heading just short of 256
   * rounds up into sector 0 instead of running off the end of the table — the circle closes. */
  const sector = u8(mem8[u16(object + HEADING_IN_RECORD)] + HALF_SECTOR) >> 4;
  const entry = u16(HEADING_SECTOR_SHAPE_TABLE + sector); // the indexed entry the shape byte is fetched from

  /* Shape: the ROM loads HL with 0x3FCA and does `rst 0x08` (fetchTableByte), which returns the
   * byte at table + sector. That byte is the picture for this direction. */
  mem8[u16(sprite + SHAPE_IN_ENTRY)] = fetchTableByte(m, HEADING_SECTOR_SHAPE_TABLE, sector);
  /* Attribute: the same sector's entry in the parallel table sixteen bytes further on. The ROM
   * reaches it by adding 0x10 to the pointer the fetch left behind, so the two tables must stay
   * exactly one table-length apart for shape and attribute to stay paired. */
  mem8[u16(sprite + SECOND_BYTE_IN_ENTRY)] = mem8[u16(entry + SECOND_TABLE_GAP)];
}
