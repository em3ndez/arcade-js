// SPDX-License-Identifier: GPL-3.0-only
/**
 * blinkSpritePairOff — the "blink OFF" arm of the colour-cycle blink driver: force bit 7
 * (flip/visibility) clear on both decorative blink sprites (records 0 and 1 in the sprite
 * shadow buffer), committing record 1 through the shared store tail (which applies its
 * once-per-sweep tile toggle from the sweep counter in a register).
 *
 * LIVE-OUT: memory-only — the two sprite code bytes.
 */
import { SPRITE_BUFFER } from "./names.js";
import { storeBlinkSpriteCode } from "./storeBlinkSpriteCode.js";

const SPRITE0_CODE = SPRITE_BUFFER + 1;
const SPRITE1_CODE = SPRITE_BUFFER + 5;

export function blinkSpritePairOff(m) {
  const { mem8 } = m;

  mem8[SPRITE0_CODE] = mem8[SPRITE0_CODE] & 0x7f;

  storeBlinkSpriteCode(m, mem8[SPRITE1_CODE] & 0x7f);
}
