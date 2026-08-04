// SPDX-License-Identifier: GPL-3.0-only
/**
 * blinkSpritePairByX — pick a decorative sprite pair's blink phase from the player's
 * screen half.
 *
 * On the rivet board the colour-cycle driver blinks a pair of decorative sprites — the
 * first two records of the sprite shadow buffer — by driving the top bit of their code
 * bytes, the flip/visibility bit. The driver splits its work on a bit of its sweep
 * counter, and this routine is the half that routes purely on where Mario is:
 *
 *   - Mario in the right half of the screen  ->  the pair blinks OFF (that bit forced
 *                                                clear on both code bytes)
 *   - Mario in the left half                 ->  the pair blinks ON  (that bit set on
 *                                                both code bytes)
 *
 * The split is the screen midpoint and the test is inclusive on the right, so exactly
 * midway counts as the right half. Both arms write both code bytes, so the two are
 * always distinguishable and the branch is observable on every input.
 *
 * This routine writes no memory of its own, and sets nothing up for the arm it picks:
 * the sweep counter the shared store tail consumes is already where that tail reads it.
 *
 * LIVE-OUT: memory-only — the pair's two code bytes, written by whichever arm runs.
 */
import { MARIO_X } from "./names.js";
import { blinkSpritePairOff } from "./blinkSpritePairOff.js";
import { blinkSpritePairOn } from "./blinkSpritePairOn.js";

export function blinkSpritePairByX(m) {
  // Route the blink by the player's screen half; exactly midway counts as the right.
  if (m.mem.read8(MARIO_X) >= 0x80) {
    blinkSpritePairOff(m); // right half: the pair goes dark
  } else {
    blinkSpritePairOn(m); // left half: the pair lights up
  }
}
