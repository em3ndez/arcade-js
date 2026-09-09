// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { advancePathAccumulator } from "./advancePathAccumulator.js";
import { loc_88, loc_8d, loc_94 } from "./names.js";

/**
 * decrementActiveObjectDelay -- tick down the active object's per-slot delay counter, then hand off to the
 * accumulator-advance spine. ROM 0x2ac? (falls straight into advancePathAccumulator at 0x2ace).
 *
 * Role in the machine: an entry that prefixes the path accumulator with one extra bookkeeping tick. Each
 * moving object has a per-slot delay counter in the $94 bank; before advancing the object's scripted path
 * this routine ages that counter by one, then falls through into the shared accumulator spine so the same
 * frame both decrements the delay and steps the path.
 *
 * Saves the caller index, indexes the delay bank by the active-object cell, decrements that entry, and
 * falls through, passing the step through to the accumulator advance. Live-out: $8d = caller index,
 * $94+$88 decremented, plus everything advancePathAccumulator writes. Grounding: [code].
 */
export function decrementActiveObjectDelay(m, x = m.regs.x, a = m.regs.a) {
  const { mem8 } = m;
  mem8[loc_8d] = x; // save the caller index; the spine restores X from here
  // Pick which object's delay to tick. $88 is the active-object/slot selector shared across the movement
  // subsystem; it indexes the $94 delay bank so each object ages its own counter.
  const obj = mem8[loc_88]; // active-object selector
  mem8[(loc_94 + obj) & 0xff] = u8(mem8[(loc_94 + obj) & 0xff] - 1); // tick the delay counter
  // Fall through into the accumulator-advance spine, forwarding the caller's A (the path delta) and X.
  // On the ROM this is a literal fall-through into the next routine, reproduced here as a tail call.
  return advancePathAccumulator(m, a, x); // fall through into the accumulator-advance spine
}
