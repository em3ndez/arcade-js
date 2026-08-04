// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2766 — start Mario falling and clear the edge-reposition flag.
 *
 * A leaf reached from an edge case of the vertical movers: it raises the one-shot
 * MARIO_START_FALL trigger, so the player-state reset launches Mario's fall on the next frame,
 * and clears EDGE_REPOSITION_FLAG so the reposition that has just finished is not worked through
 * a second time. It takes no inputs and writes exactly those two cells.
 *
 * LIVE-OUT: memory-only — MARIO_START_FALL and EDGE_REPOSITION_FLAG.
 */
import { EDGE_REPOSITION_FLAG, MARIO_START_FALL } from "./names.js";

/** @param {object} m  the machine (uses m.mem only). @returns {void} */
export function loc_2766(m) {
  const { mem } = m;
  mem.write8(EDGE_REPOSITION_FLAG, 0);
  mem.write8(MARIO_START_FALL, 1);
}
