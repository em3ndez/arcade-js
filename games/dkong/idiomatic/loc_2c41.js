// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2c41 — head of the barrel slot-claim cluster: stir the random seed, then route to one of
 * two claim-mode entries on the seed's low nibble.
 *
 * This stirs the once-per-vblank pseudo-random seed and reads its low nibble as a 1-in-16 coin
 * flip. On the 15-of-16 nonzero outcome it runs the mode-3 entry, which clears the slot-claim
 * request flag up front; on the 1-of-16 zero outcome it runs the mode-1 entry. Both entries
 * then run the shared periodic-event gate against the caller's bonus value and, when that gate
 * fires, claim the first free object slot. So this head decides only which mode value tags the
 * claim and whether the request flag is pre-cleared; the scratch writes and the slot scan
 * belong to the entry it picks.
 *
 * The bonus value is the caller's, and this head never touches it — stirring the seed leaves it
 * alone, and whichever entry runs reads it for itself.
 *
 * WHAT THE CLAIM IS FOR: a claim ends by raising bit 7 of the barrel claim-mode byte, and the
 * barrel released one frame later reads that bit to choose between two kinds of barrel. The
 * bit-7-CLEAR kind rolls along the girders; the bit-7-SET kind drops with its X pinned. The two
 * coexist on screen. So this coin flip is one of the inputs that decides what the next barrel
 * does.
 *
 * NOT CLAIMED: which named object either barrel kind is.
 *
 * Reads: nothing of its own beyond what the seed stir reads. Writes: the seed, plus whatever
 * the chosen mode entry writes.
 *
 * LIVE-OUT: memory-only.
 */

import { stirRandomSeed } from "./stirRandomSeed.js";
import { loc_2c86 } from "./loc_2c86.js";
import { loc_2c49 } from "./loc_2c49.js";

/**
 * @param {object} m  the machine. The bonus value arrives in a register and is consumed by
 *                    whichever mode entry this head selects.
 * @returns {void}
 */
export function loc_2c41(m) {
  const { regs } = m;

  // Stir the once-per-vblank random seed; the stir leaves the fresh seed here.
  stirRandomSeed(m);
  const seed = regs.a;

  // The seed's low nibble picks the slot-claim mode: a nonzero nibble (15 of every 16 seeds) takes
  // the clear-then-mode-3 entry, a zero nibble (1 of 16) the mode-1 entry.
  if ((seed & 0x0f) !== 0) {
    loc_2c86(m);
  } else {
    loc_2c49(m);
  }
}
