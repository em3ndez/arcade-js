// SPDX-License-Identifier: GPL-3.0-only
/** dressPlayerSpriteForHeading — refresh one fixed sprite entry's shape and the byte beside it from the direction
 * cell. The direction is a point on a 256-step circle; rounded to the nearest of thirty-two equal
 * sectors it indexes two parallel thirty-two-entry tables in the program image, the first holding
 * the shape and the second the byte that goes with it. LIVE-OUT: memory-only. */

import { offsetAddress } from "./offsetAddress.js";
import { u8 } from "../../../core/int.js";
import { PLAYER_HEADING, PLAYER_SPRITE_ATTRIBUTE } from "./names.js";

const SHAPE_BY_SECTOR = 0x20ce;
const SECTORS = 32;
const STEPS_PER_SECTOR = 256 / SECTORS;
const SECOND_TABLE = SECTORS;
const SHAPE_CELL = 0xaa11;

export function dressPlayerSpriteForHeading(m) {
  const { mem8, regs } = m;
  const sector = Math.floor(u8(mem8[PLAYER_HEADING] + STEPS_PER_SECTOR / 2) / STEPS_PER_SECTOR);
  regs.hl = SHAPE_BY_SECTOR;
  regs.a = sector;
  const entry = offsetAddress(m);
  mem8[SHAPE_CELL] = mem8[entry];
  mem8[PLAYER_SPRITE_ATTRIBUTE] = mem8[entry + SECOND_TABLE];
}
