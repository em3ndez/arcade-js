// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2766 — start Mario falling and clear the edge-reposition flag.  ROM 0x2766.
 *
 * A leaf reached from a vertical-mover edge case: it raises the one-shot MARIO_START_FALL trigger
 * (the player-state reset launches Mario's fall next frame) and clears EDGE_REPOSITION_FLAG so the
 * just-finished reposition is not re-processed. Takes no inputs, writes exactly those two cells.
 *
 * Faithful to translated/loc_2766.js.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2766.test.js.
 */
import { EDGE_REPOSITION_FLAG, MARIO_START_FALL } from "./names.js";

/** @param {object} m  the machine (uses m.mem only). @returns {void} */
export function loc_2766(m) {
  const { mem } = m;
  mem.write8(EDGE_REPOSITION_FLAG, 0);
  mem.write8(MARIO_START_FALL, 1);
}
