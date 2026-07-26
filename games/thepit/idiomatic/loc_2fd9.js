// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2fd9 — commit the chosen background-animation flip tile, then hand off to
 * the shared animation-update tail.  ROM 0x2fd9.
 *
 * The dirt/shaft backdrop flips between two tile codes every few frames to give it
 * a shimmer. The routine just above this one decides which of the two tiles is
 * showing this cycle; loc_2fd9 is the short commit tail both of its arms fall into.
 * Its whole job is two steps:
 *   - store the tile the caller just chose into the background-animation tile cell;
 *   - continue into the shared animation-update tail. That hand-off is a tail
 *     jump, not a nested call: the tail's own return unwinds straight back to
 *     loc_2fd9's caller, so this delegation IS loc_2fd9's exit.
 *
 * The tile choice arrives in the register the calling routine (still the frozen
 * oracle) left it in — a genuine oracle boundary — so it is read off the machine
 * rather than taken as a parameter; likewise the tail (0x2fe3) is still oracle, so
 * the hand-off stays a registry call. Name kept as loc_2fd9: the role here is a
 * best-effort reading of a two-tile backdrop flip, and the tile cell it writes is
 * not yet a confirmed, named work-RAM field — below the bar to promote to English.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2fd9.test.js.
 * GATE:     crafted-entry — 0x2fd9 is never dispatched in attract (its whole
 *           subsystem stays idle there), so a real sibling state is captured and
 *           the target is invoked on it; the tail 0x2fe3 (also never translated)
 *           is delegated to one identical stub on both sides. EQUAL over the full
 *           256-value input sweep + a forced real dispatch through unitEquivalence.
 * LIVE-OUT: memory-only — the one byte at the animation tile cell (0x80dc); the
 *           shared tail owns everything after the hand-off, identically both sides.
 * NAMES:    none — 0x80dc (the background-animation tile cell) and 0x2fe3 (the
 *           shared animation-update tail) are both still unnamed in ram.js.
 */
export function loc_2fd9(m) {
  // Store the caller's just-chosen flip tile into the background-animation cell.
  m.mem8[0x80dc] = m.regs.a;

  // Tail hand-off into the shared animation-update tail; its return goes to our
  // caller, so this is loc_2fd9's exit.
  return m.call(0x2fe3);
}
