// SPDX-License-Identifier: GPL-3.0-only
import { loc_7627 } from "./loc_7627.js";

const ENTRY_COUNT = 0x0e; // records this twin entry ticks

/**
 * loc_7621 — twin entry to the shared animation-tick walk.
 *
 * Seeds the record count (14) and runs the shared walk over the enemy-actor array.
 *
 * LIVE-OUT: none — a void delegator; the walk acts on memory and the caller reads nothing back.
 */
export function loc_7621(m) {
  loc_7627(m, ENTRY_COUNT);
}
