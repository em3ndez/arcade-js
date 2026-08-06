// SPDX-License-Identifier: GPL-3.0-only
/** loc_2a57 — pick the sprite shape, and the byte beside it, that show an object pointing the
 * way it is heading. The heading is a point on a 256-step circle; rounded to the nearest of
 * sixteen equal sectors it indexes two parallel sixteen-entry tables, the first holding the
 * shape and the second the byte that mirrors it — eight shapes cover the circle because the rest
 * reuse them mirrored, and the tint those bytes carry is the same in every entry. Every other
 * pair of frames the shape moves on by eight, so each direction alternates between two.
 * LIVE-OUT: the pair, left standing for the caller to store into the object's sprite entry.
 * Nothing is written. */

import { u8, u16 } from "../../../core/int.js";

const HEADING = 2;
const SECTORS = 16;
const STEPS_PER_SECTOR = 256 / SECTORS;
const SHAPE_BY_SECTOR = 0x2a77;
const MIRROR_BY_SECTOR = 0x2a87;
const ANIMATION_COUNTER = 0xa980;
const FAR_HALF_BIT = 2;
const SHAPES_PER_HALF = 8;

export function loc_2a57(m, object = m.regs.ix) {
  const { regs, mem8 } = m;
  const heading = mem8[u16(object + HEADING)];
  const sector = Math.floor(u8(heading + STEPS_PER_SECTOR / 2) / STEPS_PER_SECTOR);
  const farHalf = (mem8[ANIMATION_COUNTER] & FAR_HALF_BIT) !== 0;
  regs.b = mem8[SHAPE_BY_SECTOR + sector] + (farHalf ? SHAPES_PER_HALF : 0);
  regs.c = mem8[MIRROR_BY_SECTOR + sector];
}
