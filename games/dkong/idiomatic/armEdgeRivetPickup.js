// SPDX-License-Identifier: GPL-3.0-only
/**
 * armEdgeRivetPickup — raise the edge-item pickup latch.
 *
 * The "arm" half of a two-pass, set-then-consume latch. The edge-item pickup runs every
 * in-game frame; it reads the player's X and, when the player is standing on one of the
 * two screen-EDGE columns, hands over to this routine, which unconditionally raises
 * EDGE_RIVET_ARMED and returns. On a LATER frame — once the player is no longer on the
 * exact edge — the pickup takes its other path: it collects only if the flag is raised,
 * and the collect handler's first act disarms the flag by writing 0 back. So
 * EDGE_RIVET_ARMED is a rivet-scoped one-shot: raised on the edge-hit frame, consumed and
 * cleared on the following collect frame, which is where a rivet slot is cleared and the
 * rivet count decremented.
 *
 * The store is UNCONDITIONAL — the edge test that decides whether this runs at all lives
 * upstream, not here. A LEAF: reads nothing, calls nothing, writes exactly one byte.
 *
 * LIVE-OUT: memory-only — EDGE_RIVET_ARMED := 1.
 */

import { EDGE_RIVET_ARMED } from "./names.js";

/**
 * @param {object} m  the machine (uses m.mem only).
 */
export function armEdgeRivetPickup(m) {
  // Raise the latch. Unconditional: the screen-edge test that gates this lives upstream,
  // and the pickup consumes and disarms the latch on a later frame.
  m.mem.write8(EDGE_RIVET_ARMED, 0x01);
}
