// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2e9c — animation-string terminator handler: rewind the walk pointer to the string base and
 * fire the wrap sound trigger, then fall into the object-update convergence point (which stores the
 * pointer back, runs the end-of-walk boundary test, and mirrors position to the sprite).
 *
 * LIVE-OUT: the wrap sound trigger and everything the convergence point writes, plus the tail's
 * registers — object cursor +16, sprite cursor +4, remaining-object count preserved, step value 4.
 */

import { SND_TRIGGER } from "./names.js";
import { advanceSpringArcAndDropAtTravelEnd } from "./advanceSpringArcAndDropAtTravelEnd.js";

const ANIMATION_STRING_BASE = 0x39aa;

export function loc_2e9c(m) {
  const { regs, mem8 } = m;

  regs.hl = ANIMATION_STRING_BASE;
  mem8[SND_TRIGGER + 3] = 0x03;
  advanceSpringArcAndDropAtTravelEnd(m);
}
