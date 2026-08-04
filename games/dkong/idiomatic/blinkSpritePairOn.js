// SPDX-License-Identifier: GPL-3.0-only
/**
 * blinkSpritePairOn — the colour-cycle blink driver's "blink ON" arm: raise the blink bit
 * (bit 7) on BOTH decorative blink sprites, then commit via the shared store tail.
 *
 * The per-frame colour-cycle driver makes a pair of decorative sprites — records 0 and 1 in
 * the sprite shadow buffer — blink by driving bit 7, the flip/visibility bit, of their code
 * bytes through three arms: leave-as-is, this "blink ON" arm, and its exact mirror, "blink
 * OFF". This is the ON phase:
 *
 *   1. It sets the blink bit in record 0's code byte in place.
 *   2. It sets the blink bit in record 1's code byte and hands the result to the shared
 *      blink-store tail, which commits it and may apply its once-per-sweep low-two-bit tile
 *      toggle, driven by the sweep counter staged in a register.
 *
 * The ON phase is reached on the rivet board only, selected by Kong's X and the sweep
 * counter's bit 6. Writes exactly the two code bytes; reads those two bytes and the sweep
 * counter.
 *
 * LIVE-OUT: memory-only — the two sprite code bytes.
 */
import { SPRITE_BUFFER } from "./names.js";
import { storeBlinkSpriteCode } from "./storeBlinkSpriteCode.js";

// Record 0's code byte inside the sprite shadow buffer: base + 0 (record 0) + 1 (code).
const SPRITE0_CODE = SPRITE_BUFFER + 1;
// Record 1's code byte inside the sprite shadow buffer: base + 4 (record 1) + 1 (code).
const SPRITE1_CODE = SPRITE_BUFFER + 5;

const BLINK_BIT = 0x80; // bit 7 — the code byte's flip/visibility bit the driver blinks

export function blinkSpritePairOn(m) {
  const { regs, mem } = m;

  // 1. Set the blink bit on record 0's code byte, in place.
  mem.write8(SPRITE0_CODE, mem.read8(SPRITE0_CODE) | BLINK_BIT);

  // 2. Stage record 1's code byte with the blink bit set, and hand it to the shared
  //    blink-store tail, which commits it (with the phase-gated tile toggle).
  regs.a = mem.read8(SPRITE1_CODE) | BLINK_BIT;
  storeBlinkSpriteCode(m);
}
