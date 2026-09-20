// SPDX-License-Identifier: GPL-3.0-only
/**
 * setChamberCreatureFrame — commit the chosen chamber-creature sprite-flip tile, then hand off
 * to the shared animation-update tail.  (§2.8)
 * The creature's sprite flips between two tile codes every few frames; the routine just above
 * chooses which tile shows this cycle. This stores that tile into CHAMBER_CREATURE_FRAME, then
 * tail-jumps into the shared animation-update tail, whose return unwinds back to this caller.
 */

import { CHAMBER_CREATURE_FRAME } from "./names.js";
export function setChamberCreatureFrame(m, a = m.regs.a) {
  // Store the caller's just-chosen flip tile into the creature's frame cell.
  m.mem8[CHAMBER_CREATURE_FRAME] = a;

  // Tail hand-off into the shared animation-update tail; its return goes to our caller.
  return m.call(0x2fe3);
}
