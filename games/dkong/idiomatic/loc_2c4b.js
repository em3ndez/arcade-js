// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2c4b — one entry of the barrel slot-claim cluster: record the caller's mode byte, then
 * run the shared slot-claim body with that byte bumped by one.
 *
 * This entry stores the caller's mode byte into the barrel claim-mode cell and then runs the
 * shared body with the mode byte INCREMENTED — so the body's own scratch copy always sits one
 * above the claim-mode cell, because the increment happens between the two stores. That
 * offset-by-one is this entry's whole distinguishing move; the sibling entries of the cluster
 * differ only in which mode value they stamp and whether the request flag is pre-cleared.
 *
 * The shared body then runs the periodic-event gate against the bonus value passed through
 * from the caller. On a hit it steps the event mark down and claims the first free object
 * slot, raising bit 7 of that same claim-mode byte; on a miss it does only the two scratch
 * writes.
 *
 * BIT 7 IS THE BARREL-KIND SELECT. A claim leaves the claim-mode byte as the mode value with
 * its top bit set, and the barrel released one frame later reads that bit to choose between
 * two kinds of barrel: the bit-7-CLEAR kind ROLLS along the girders, while the bit-7-SET kind
 * DROPS with its X pinned. The two coexist on screen. So the byte this entry writes is a mode
 * VALUE in its low bits, not a bare flag.
 *
 * NOT CLAIMED: which named object either barrel kind is. What is established is that the two
 * kinds differ in sprite code, attribute and mode byte, and in whether they roll or drop.
 *
 * Reads: nothing of its own — the mode byte and the bonus value are the caller's.
 * Writes: the barrel claim-mode cell; and through the shared body, that same cell's bit 7 on
 * a claim, the body's two scratch cells, and the bonus event mark.
 *
 * LIVE-OUT: memory-only.
 */

import { BARREL_CLAIM_MODE } from "./names.js";
import { armBarrelRelease } from "./armBarrelRelease.js";

/**
 * @param {object} m         the machine (uses m.mem only).
 * @param {number} modeByte  the caller's mode byte: stored in the claim-mode cell, then handed
 *                           on incremented.
 * @param {number} bonus     the current bonus value the shared body's event gate tests against.
 * @returns {void}
 */
export function loc_2c4b(m, modeByte, bonus) {
  const { mem } = m;

  // Record the mode byte, then run the shared body with it bumped by one — so the body's
  // scratch copy ends up one above the claim-mode cell.
  mem.write8(BARREL_CLAIM_MODE, modeByte);
  armBarrelRelease(m, modeByte + 1, bonus);
}
