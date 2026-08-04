// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchCreditedSubstate — run the right step of the credited game, once per frame.
 *
 * "Credited" is the short stretch after a coin has been accepted and before play begins. It is a
 * two-step machine, and this routine is what advances it: it reads the sub-state index and vectors
 * through a 2-entry table of code addresses to the step for that index.
 *
 *   step 0 — set the credited game up: clear the playfield, mark that the credit has been taken,
 *            queue the intro, and move on to step 1.
 *   step 1 — wait for the start button; when it comes, record whether it was one player or two and
 *            hand the game over to play.
 *
 * The selector is NOT range-checked and the table has only those two slots, so a byte outside 0..1
 * would read a target out of whatever data follows. Nothing writes anything but 0 or 1 there.
 *
 * The index is doubled to a byte offset with an 8-BIT result, so the address math is
 * `base + (2 * index & 0xff)` and an index of 0x80 wraps the offset back to zero. That wrap is not
 * decoration — it is what any out-of-range index would actually do.
 *
 * Because the target is a genuine code address computed at run time, the dispatch goes through the
 * generic address dispatcher rather than a table of JS functions. No register hand-off survives it:
 * neither step reads anything the vector left behind.
 *
 * LIVE-OUT: memory-only — whatever the dispatched step writes. This routine returns nothing.
 */

import { GAME_SUBSTATE } from "./names.js";
import { loc_00ca } from "../translated/loc_00ca.js";

// The inline jump table: 2 little-endian target addresses, indexed by the sub-state.
const SUBSTATE_TABLE = 0x08b6;

// A label for the dispatch site. It only ever surfaces inside a NotImplemented throw, to say which
// table an out-of-range selector fell off of.
const DISPATCH_TABLE_08B6 = "0x08B6 (0x600A, 2-entry)";

export function dispatchCreditedSubstate(m) {
  const { mem } = m;

  // The credited game's step index: 0 or 1.
  const substate = mem.read8(GAME_SUBSTATE);

  // Double the index to a table offset, wrapping at a byte, and read the target address there.
  const entry = (SUBSTATE_TABLE + ((substate * 2) & 0xff)) & 0xffff;
  const target = mem.read8(entry) | (mem.read8((entry + 1) & 0xffff) << 8);

  // Run that step. Its return value is discarded at this level.
  loc_00ca(m, target, DISPATCH_TABLE_08B6);
}
