// SPDX-License-Identifier: GPL-3.0-only
/**
 * blinkSpritePairOff — the "blink OFF" arm of the colour-cycle blink driver: force the blink
 * bit off on the pair of decorative sprites.
 *
 * The colour-cycle driver blinks two decorative sprites — records 0 and 1 in the sprite
 * shadow buffer — by driving bit 7, the flip/visibility bit, of their code bytes. It has
 * three arms: leave-as-is, blink ON, and this one, blink OFF. This arm forces bit 7 clear on
 * both records:
 *
 *   - Record 0's code byte is masked clear and committed here directly.
 *   - Record 1's code byte is masked clear and handed to the shared store tail — the one
 *     place that stores record 1 — which commits it and applies the once-per-sweep
 *     low-two-bits tile toggle keyed on the colour-cycle sweep counter staged in a register.
 *
 * The OFF phase is taken on the 100m rivet board and on specific colour paths, so it is not
 * a per-frame arm. The two bytes it leaves are a total function of those two bytes and the
 * sweep counter; it reads nothing else and calls nothing but the store tail.
 *
 * LIVE-OUT: memory-only — the two sprite code bytes.
 */
import { SPRITE_BUFFER } from "./names.js";
import { storeBlinkSpriteCode } from "./storeBlinkSpriteCode.js";

// Code bytes of the two blinked decorative sprites inside the sprite shadow buffer:
// record 0 at base + 1, record 1 at base + 5 (record stride 4, +1 to the code field).
const SPRITE0_CODE = SPRITE_BUFFER + 1;
const SPRITE1_CODE = SPRITE_BUFFER + 5;

export function blinkSpritePairOff(m) {
  const { regs, mem } = m;

  // Record 0: force the blink bit (bit 7) off, committed here directly.
  mem.write8(SPRITE0_CODE, mem.read8(SPRITE0_CODE) & 0x7f);

  // Record 1: clear the blink bit, then hand the finished code byte to the shared store
  // tail in the accumulator. The tail commits it and runs the once-per-sweep tile toggle.
  regs.a = mem.read8(SPRITE1_CODE) & 0x7f;
  storeBlinkSpriteCode(m);
}
