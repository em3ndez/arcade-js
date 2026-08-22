// SPDX-License-Identifier: GPL-3.0-only
import { loc_7627 } from "./loc_7627.js";

const ENTRY_COUNT = 0x08; // records this twin entry ticks

/**
 * loc_7625 — twin entry to the shared animation-tick walk.
 *
 * Seeds the record count (8) and runs the shared walk over the enemy-actor array.
 *
 * LIVE-OUT: none — a void delegator; the walk acts on memory and the caller reads nothing back.
 */
export function loc_7625(m) {
  loc_7627(m, ENTRY_COUNT);
}
