// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { SPRITE_SHADOW_CODE, loc_34, SPRITE_SHADOW_ATTR } from "./names.js";
import { buildObjectShadowEntry } from "./serviceFrameIrq.js";
import { accumulateTrackballAndReturnFromIrq } from "./accumulateTrackballAndReturnFromIrq.js";

/**
 * storeSpriteShadowEntry — tail of the per-object sprite-shadow loop (ROM 0x3956). [code]
 *
 * ROLE. One of four routines that form the frame interrupt's sprite-shadow machine
 * (serviceFrameIrq is the front, buildObjectShadowEntry and this walk the object table,
 * accumulateTrackballAndReturnFromIrq is the tail). buildObjectShadowEntry computes an
 * object's code byte and hands it here; this routine finishes that object — storing its
 * code and attribute shadow rows — then either steps back to the previous object or, once
 * the whole table is done, falls into the interrupt tail. The four shadow rows this loop
 * fills (code, horizontal, vertical, attribute) are the per-object table the video layer
 * reads straight out of RAM to draw the sprites.
 *
 * MECHANISM. Two writes land per object. The value passed in A goes to the object's code
 * row (SPRITE_SHADOW_CODE + X, the picture/tile code the display shows). The attribute
 * byte (colour/size) is derived from bit 6 of the object's tile/attribute source cell
 * (loc_34 + X): when that bit is set the attribute takes 0x40 for the high object slots but
 * a smaller floor of 0x0c for the low slots (the low slots need a different attribute band),
 * and either way it is OR'd with the fixed base 0x39 before being stored to SPRITE_SHADOW_ATTR + X.
 * The loop then walks the object index DOWN by one; the sign bit tells it when the index has
 * underflowed past object 0.
 *
 * LIVE-OUT. Writes SPRITE_SHADOW_CODE + X and SPRITE_SHADOW_ATTR + X, then tail-calls the
 * builder again (more objects) or the interrupt tail (done). @returns {number} pass-through.
 */
export function storeSpriteShadowEntry(m, x = m.regs.x, a = m.regs.a) {
  const { mem8 } = m;
  // Store this object's picture/tile code into its shadow code row.
  mem8[u16(SPRITE_SHADOW_CODE + x)] = a;
  // Build the attribute (colour/size) byte from bit 6 of the tile source; the low object
  // slots take a smaller floor (0x0c) than the high slots (0x40), then OR in the fixed base.
  let attr = 0x00;
  if (mem8[u8(loc_34 + x)] & 0x40) attr = x >= 12 ? 0x40 : 0x0c; // low slots floor the attribute
  mem8[u16(SPRITE_SHADOW_ATTR + x)] = attr | 0x39;

  // Step to the previous object; a set sign bit means we underflowed past slot 0.
  const nx = u8(x - 1);
  if ((nx & 0x80) === 0) return buildObjectShadowEntry(m, nx); // more objects: re-enter the builder
  // Whole table refreshed -> drop into the interrupt tail (trackball integrate + IRQ ack).
  return accumulateTrackballAndReturnFromIrq(m);
}
