// SPDX-License-Identifier: GPL-3.0-only
/** dressSpriteForCoarseHeading — show an object pointing the way it is heading: its heading byte is rounded to one of
 * sixteen sectors, and that sector picks a shape and the byte beside it out of two parallel tables
 * in the program image, sixteen entries apart. The pair goes into the object's sprite entry, the
 * shape in one slot and the other byte in a slot further on. Rounding adds half a sector before
 * taking the top nibble, so a heading is snapped to the NEAREST sector rather than truncated, and
 * that addition wraps, which is what closes the circle of sectors. LIVE-OUT: memory, two bytes. */

import { u8, u16 } from "../../../core/int.js";
import { offsetAddress } from "./offsetAddress.js";

const HEADING_IN_RECORD = 2;
const SHAPE_TABLE = 0x2b18;
const SECOND_TABLE_GAP = 16;
const SHAPE_IN_ENTRY = 1;
const SECOND_BYTE_IN_ENTRY = 48;
const HALF_SECTOR = 8;

export function dressSpriteForCoarseHeading(m, object = m.regs.ix, sprite = m.regs.iy) {
  const { regs, mem8 } = m;
  const sector = u8(mem8[u16(object + HEADING_IN_RECORD)] + HALF_SECTOR) >> 4;

  regs.hl = SHAPE_TABLE;
  regs.a = sector;
  const shapeEntry = offsetAddress(m);

  mem8[u16(sprite + SHAPE_IN_ENTRY)] = mem8[shapeEntry];
  mem8[u16(sprite + SECOND_BYTE_IN_ENTRY)] = mem8[u16(shapeEntry + SECOND_TABLE_GAP)];
}
