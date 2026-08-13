// SPDX-License-Identifier: GPL-3.0-only
/** dressSpriteForFineHeading — point an object's sprite entry the way the object is heading. The heading is a
 * point on a 256-step circle; rounded to the nearest of thirty-two equal sectors it selects a
 * two-byte entry of a table, whose first byte is the shape and whose second is the byte laid
 * beside it. Every other pair of frames the shape moves on by eight, so each sector alternates
 * between two shapes while the byte beside it does not change. Both go straight into the sprite
 * entry the caller's cursor names — this reads the object and writes the entry, and decides
 * nothing about either. LIVE-OUT: memory. */

import { u8, u16 } from "../../../core/int.js";
import { offsetAddress } from "./offsetAddress.js";
import { FRAME_TICK, loc_2abc } from "./names.js";

const HEADING = 2;
const SECTORS = 32;
const STEPS_PER_SECTOR = 256 / SECTORS;
const ENTRY_WIDTH = 2;
const FAR_HALF_BIT = 2;
const SHAPES_PER_HALF = 8;
const SHAPE_IN_ENTRY = 1;
const BESIDE_IT_IN_ENTRY = 48;

export function dressSpriteForFineHeading(m) {
  const { mem8, regs } = m;
  const entry = regs.iy;
  const heading = mem8[u16(regs.ix + HEADING)];
  const sector = Math.floor(u8(heading + STEPS_PER_SECTOR / 2) / STEPS_PER_SECTOR);

  regs.hl = loc_2abc;
  regs.a = sector * ENTRY_WIDTH;
  const selected = offsetAddress(m);

  const farHalf = (mem8[FRAME_TICK] & FAR_HALF_BIT) !== 0;
  mem8[entry + SHAPE_IN_ENTRY] = mem8[selected] + (farHalf ? SHAPES_PER_HALF : 0);
  mem8[entry + BESIDE_IT_IN_ENTRY] = mem8[u16(selected + 1)];
}
