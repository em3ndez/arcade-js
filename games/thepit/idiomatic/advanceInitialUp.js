// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceInitialUp — step an object's cyclic index up one notch and request the step sound.
 * The index is either disengaged (off value 255) or engaged in 10..35. This nudges it up one
 * and plays the step sound; the roll-over and disengage cases (255 -> 10, past-top -> 255)
 * are handled inline below. The new index is handed back for the caller to act on — the
 * step-up counterpart of the sibling that walks the same index the other way. The role the
 * index plays (a column, a rung, a frame) is not confirmed, so the name stays neutral.
 */
import { requestSound8 } from "./requestSound8.js";

export function advanceInitialUp(m, index = m.regs.c) {
  requestSound8(m);

  let next = (index + 1) % 256; // step the index up one notch
  if (next === 0) next = 10; // disengaged 255 rolls over -> re-enter at the range bottom
  if (next > 35) next = 255; // stepped past the top -> disengage

  // Hand the new index back to the caller (also left in register C for the caller that reads it).
  m.regs.c = next;
  return next;
}
