// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { SPRITE_SHADOW_CODE, loc_34, SPRITE_SHADOW_ATTR } from "./names.js";
import { buildObjectShadowEntry } from "./serviceFrameIrq.js";
import { accumulateTrackballAndReturnFromIrq } from "./accumulateTrackballAndReturnFromIrq.js";

/**
 * storeSpriteShadowEntry — tail of the per-object shadow loop. Writes the passed value to this object's
 * shadow slot, derives its attribute byte from bit6 of $34,X (raising a floor for the low slots), then
 * decrements the index and either loops back into the shadow builder or drops into the interrupt tail. [code]
 *
 * Direct-calls the builder (re-entry) and the interrupt tail. @returns {number} pass-through.
 */
export function storeSpriteShadowEntry(m, x = m.regs.x, a = m.regs.a) {
  const { mem8 } = m;
  mem8[u16(SPRITE_SHADOW_CODE + x)] = a;
  let attr = 0x00;
  if (mem8[u8(loc_34 + x)] & 0x40) attr = x >= 12 ? 0x40 : 0x0c; // low slots floor the attribute
  mem8[u16(SPRITE_SHADOW_ATTR + x)] = attr | 0x39;

  const nx = u8(x - 1);
  if ((nx & 0x80) === 0) return buildObjectShadowEntry(m, nx); // more objects: re-enter the builder
  return accumulateTrackballAndReturnFromIrq(m);
}
