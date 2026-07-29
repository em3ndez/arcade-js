// SPDX-License-Identifier: GPL-3.0-only
/**
 * setZonkerFrame — commit the chosen Zonker sprite-flip tile, then hand off to the shared
 * animation-update tail.  ROM 0x2fd9. (§2.6)
 *
 * The dirt/shaft backdrop flips between two tile codes every few frames to give it
 * a shimmer. The routine just above this one decides which of the two tiles is
 * showing this cycle; setZonkerFrame is the short commit tail both of its arms fall into.
 * Its whole job is two steps:
 *   - store the tile the caller just chose into the background-animation tile cell;
 *   - continue into the shared animation-update tail. That hand-off is a tail
 *     jump, not a nested call: the tail's own return unwinds straight back to
 *     setZonkerFrame's caller, so this delegation IS setZonkerFrame's exit.
 *
 * The tile choice arrives in the register the calling routine (still the frozen
 * oracle) left it in — a genuine oracle boundary — so it is read off the machine
 * rather than taken as a parameter; likewise the tail (0x2fe3) is still oracle, so
 * the hand-off stays a registry call. The routine commits the Zonker tank's chosen sprite-flip
 * tile into ZONKER_FRAME (0x80dc) — the two-tile shimmer of the tank (§2.6).
 *
 * Memory-equivalent to the frozen oracle — equivalence-2fd9.test.js.
 * GATE:     crafted-entry — 0x2fd9 is never dispatched in attract (its whole
 *           subsystem stays idle there), so a real sibling state is captured and
 *           the target is invoked on it; the tail 0x2fe3 (also never translated)
 *           is delegated to one identical stub on both sides. EQUAL over the full
 *           256-value input sweep + a forced real dispatch through unitEquivalence.
 * LIVE-OUT: memory-only — the one byte at the animation tile cell (ZONKER_FRAME,
 *           0x80dc); the shared tail owns everything after the hand-off, identically
 *           both sides.
 * NAMES:    ZONKER_FRAME (0x80dc), the background-animation tile cell, from ram.js.
 *           0x2fe3 (the shared animation-update tail) is still unnamed in ram.js.
 */

import { ZONKER_FRAME } from "./ram.js";
export function setZonkerFrame(m) {
  // Store the caller's just-chosen flip tile into the background-animation cell.
  m.mem8[ZONKER_FRAME] = m.regs.a;

  // Tail hand-off into the shared animation-update tail; its return goes to our
  // caller, so this is setZonkerFrame's exit.
  return m.call(0x2fe3);
}
