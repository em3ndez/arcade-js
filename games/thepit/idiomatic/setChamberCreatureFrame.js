// SPDX-License-Identifier: GPL-3.0-only
/**
 * setChamberCreatureFrame — commit the chosen chamber-creature sprite-flip tile, then hand off to the
 * shared animation-update tail.  ROM 0x2fd9. (§2.8)
 *
 * The chamber creature's sprite flips between two tile codes every few frames. The
 * routine just above this one decides which of the two tiles is showing this cycle;
 * setChamberCreatureFrame is the short commit tail both of its arms fall into.
 * Its whole job is two steps:
 *   - store the tile the caller just chose into the creature's frame cell;
 *   - continue into the shared animation-update tail. That hand-off is a tail
 *     jump, not a nested call: the tail's own return unwinds straight back to
 *     setChamberCreatureFrame's caller, so this delegation IS setChamberCreatureFrame's exit.
 *
 * The tile choice arrives in the register the calling routine (still the frozen
 * oracle) left it in — a genuine oracle boundary — so it is read off the machine
 * rather than taken as a parameter; likewise the tail (0x2fe3) is still oracle, so
 * the hand-off stays a registry call. The routine commits the chamber creature's chosen sprite-flip
 * tile into CHAMBER_CREATURE_FRAME (0x80dc) — the creature's two-tile frame flip (§2.8).
 *
 * Memory-equivalent to the frozen oracle — equivalence-2fd9.test.js.
 * GATE:     crafted-entry — 0x2fd9 is never dispatched in attract (its whole
 *           subsystem stays idle there), so a real sibling state is captured and
 *           the target is invoked on it; the tail 0x2fe3 (also never translated)
 *           is delegated to one identical stub on both sides. EQUAL over the full
 *           256-value input sweep + a forced real dispatch through unitEquivalence.
 * LIVE-OUT: memory-only — the one byte at the animation tile cell (CHAMBER_CREATURE_FRAME,
 *           0x80dc); the shared tail owns everything after the hand-off, identically
 *           both sides.
 * NAMES:    CHAMBER_CREATURE_FRAME (0x80dc), the creature's frame cell, from ram.js.
 *           0x2fe3 (the shared animation-update tail) is still unnamed in ram.js.
 */

import { CHAMBER_CREATURE_FRAME } from "./ram.js";
export function setChamberCreatureFrame(m) {
  // Store the caller's just-chosen flip tile into the creature's frame cell.
  m.mem8[CHAMBER_CREATURE_FRAME] = m.regs.a;

  // Tail hand-off into the shared animation-update tail; its return goes to our
  // caller, so this is setChamberCreatureFrame's exit.
  return m.call(0x2fe3);
}
