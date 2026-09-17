// SPDX-License-Identifier: GPL-3.0-only
/**
 * blinkSpritePairByX — blink the rivet board's decorative sprite pair by the player's screen
 * half: Mario in the right half blinks the pair OFF, left half blinks it ON.
 *
 * LIVE-OUT: memory-only — the pair's two code bytes, written by whichever arm runs.
 */
import { MARIO_X } from "./names.js";
import { blinkSpritePairOff } from "./blinkSpritePairOff.js";
import { blinkSpritePairOn } from "./blinkSpritePairOn.js";

export function blinkSpritePairByX(m) {
  if (m.mem8[MARIO_X] >= 0x80) { // midpoint inclusive on the right
    blinkSpritePairOff(m);
  } else {
    blinkSpritePairOn(m);
  }
}
