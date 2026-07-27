// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceInitialUp — step an object's cyclic index up one notch and request sound 8.  ROM 0x4f38.
 *
 * An object carries a cyclic index that is either DISENGAGED (the off value 255) or
 * ENGAGED somewhere in the range 10..35. This routine nudges that index up by one and,
 * as it does, plays the step sound (sound command 8):
 *
 *   - Request sound 8.
 *   - Step the index up one. Stepping the disengaged value (255) rolls it over to 0,
 *     which is read as "re-engage from the bottom" and re-enters the range at 10.
 *   - If the step carried the index past the top of the engaged range (above 35), the
 *     object disengages: the index returns to the off value 255.
 *   - Otherwise the stepped index stands.
 *
 * The new index is handed back — it is the value a caller reads to act on the object.
 * This is the step-up counterpart of loc_4f26, which walks the same index the other way
 * (rolling over at the bottom, clamping at the top); both fire the same step sound.
 *
 * The role the index plays for the object (a column, a rung, a frame) is not yet
 * confirmed, so the name stays neutral.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4f38.test.js.
 * GATE:     crafted-entry — attract never requests sound 8, so this routine is never
 *           dispatched live; the gate runs it from a real captured sound-request state
 *           (a sibling sound stub's entry) and sweeps the index EXHAUSTIVELY over all
 *           256 values, pinning the roll-over (255 -> 10) and the disengage (past 35 ->
 *           255). Teeth catch a wrong roll-over target and a wrong sound command.
 * LIVE-OUT: memory (the sound ring, filled by requestSound8) + the new index, the value
 *           the caller reads back (register C). The oracle's other exit registers, flags,
 *           and Z80 return path are dead scratch a plain JS return replaces.
 * NAMES:    none directly — delegates to requestSound8 for the sound-ring write.
 */
import { requestSound8 } from "./requestSound8.js";

export function advanceInitialUp(m, index = m.regs.c) {
  // Play the step sound.
  requestSound8(m);

  // Step the index up one notch.
  let next = (index + 1) % 256;
  if (next === 0) next = 10; // rolled over off the disengaged value -> re-enter the range bottom
  if (next > 35) next = 255; // stepped past the top of the range -> disengage

  // Hand the new index back to the caller (it also lives in register C for the
  // still-oracle caller that reads it across the boundary).
  m.regs.c = next;
  return next;
}
