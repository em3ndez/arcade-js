// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepBarrelAlongReleasePath — move a barrel to its next (x, y) waypoint on the release path and
 * publish that pose as a hardware sprite, or, at the terminator waypoint, hand off to release
 * completion. One call consumes one two-byte waypoint and advances the path cursor.
 *
 * LIVE-OUT: memory-only — the published sprite record, the barrel record's sprite code, and the
 * advanced path cursor.
 */

import { RENDER_STR_PTR, RENDER_OBJ_PTR, RENDER_DST_PTR, OBJ_SPRITE_CODE, OBJ_SPRITE_ATTR,
         SPRITE_X, SPRITE_CODE, SPRITE_ATTR, SPRITE_Y } from "./names.js";
import { activateReleasedBarrel } from "./activateReleasedBarrel.js";

const TERMINATOR = 0x7f; // ends the path; doubles as the mask that strips the flag bit off X
const ATTRIBUTE_BIT = 0x80; // set on a waypoint's X byte -> flip the barrel's animation bits
const FIELD_FLIP = 0x03; // the two sprite-code bits that flip

export function stepBarrelAlongReleasePath(m, hl = m.regs.hl) {
  const { regs, mem8, mem16 } = m;

  const src = hl;
  const objPtr = mem16[RENDER_OBJ_PTR];
  const dstPtr = mem16[RENDER_DST_PTR];
  const ch = mem8[src];

  // Terminator: hand the barrel and its sprite slot to release completion via registers.
  if (ch === TERMINATOR) {
    return activateReleasedBarrel(m, objPtr, dstPtr);
  }

  mem8[dstPtr + SPRITE_X] = ch & TERMINATOR;

  // Sprite code: the barrel's own, animation bits flipped when the waypoint asks; the flipped
  // value is written back so the barrel keeps the new frame.
  let field = mem8[objPtr + OBJ_SPRITE_CODE];
  if ((ch & ATTRIBUTE_BIT) !== 0) field ^= FIELD_FLIP;
  mem8[dstPtr + SPRITE_CODE] = field;
  mem8[objPtr + OBJ_SPRITE_CODE] = field;

  mem8[dstPtr + SPRITE_ATTR] = mem8[objPtr + OBJ_SPRITE_ATTR];

  mem8[dstPtr + SPRITE_Y] = mem8[src + 1];

  mem16[RENDER_STR_PTR] = src + 2;
}
