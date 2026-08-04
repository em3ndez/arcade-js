// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepBarrelAlongReleasePath — move a barrel to its next waypoint on the release path and publish
 * that pose as a hardware sprite, or, at the end of the path, hand off to release completion.
 *
 * NOT A STRING RENDERER. The table this walks is (x, y) waypoint PAIRS, not text: the first byte
 * of each pair lands in the sprite record's X field and the second in its Y field. Nothing here
 * ever touches video RAM.
 *
 * The path cursor arrives in a register; the barrel's object record and the sprite slot to publish
 * into are read from RAM. One call consumes one two-byte waypoint:
 *
 *   sprite X    <- the first byte with its top bit stripped.
 *   sprite code <- the barrel's own sprite code, with its low two bits flipped first if that top
 *                  bit was SET. The flipped value is written BACK into the barrel record, so the
 *                  flip persists into the following waypoints rather than being a one-frame pose.
 *                  Those two bits are what steps the barrel between its animation frames.
 *   sprite attr <- the barrel's own sprite attribute, copied straight through.
 *   sprite Y    <- the second byte of the pair.
 *
 * The cursor then advances two bytes and is stored back, so the next call takes the next waypoint.
 *
 * A first byte of 0x7F ends the path: the barrel record and the sprite slot are handed to the
 * release-completion step and this routine returns whatever that returns. The sentinel costs one X
 * value, which is why the same 0x7F doubles as the mask that strips the flag bit.
 *
 * NOT CLAIMED: which of the two barrel kinds is on the path. The flag bit selects an animation
 * pair, but nothing in this file says what either pose depicts.
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

export function stepBarrelAlongReleasePath(m) {
  const { regs, mem } = m;

  const src = regs.hl; // path cursor
  const objPtr = mem.read16(RENDER_OBJ_PTR); // the barrel record being moved
  const dstPtr = mem.read16(RENDER_DST_PTR); // the sprite slot to publish into
  const ch = mem.read8(src); // this waypoint's X byte, flag bit included

  // End of the path: hand the barrel and its sprite slot to release completion. Those arrive in
  // registers there, so they are marshalled in here.
  if (ch === TERMINATOR) {
    regs.ix = objPtr;
    regs.de = dstPtr;
    return activateReleasedBarrel(m);
  }

  // X — the waypoint byte with its flag bit stripped.
  mem.write8(dstPtr + SPRITE_X, ch & TERMINATOR);

  // Sprite code — the barrel's own, with its animation bits flipped when the waypoint asks for it;
  // the flipped value is written back so the barrel keeps the new frame.
  let field = mem.read8(objPtr + OBJ_SPRITE_CODE);
  if ((ch & ATTRIBUTE_BIT) !== 0) field ^= FIELD_FLIP;
  mem.write8(dstPtr + SPRITE_CODE, field);
  mem.write8(objPtr + OBJ_SPRITE_CODE, field);

  // Attribute — copied straight from the barrel record.
  mem.write8(dstPtr + SPRITE_ATTR, mem.read8(objPtr + OBJ_SPRITE_ATTR));

  // Y — the second byte of the waypoint pair.
  mem.write8(dstPtr + SPRITE_Y, mem.read8(src + 1));

  // Advance the cursor past this waypoint.
  mem.write16(RENDER_STR_PTR, src + 2);
}
