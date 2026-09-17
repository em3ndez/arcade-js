// SPDX-License-Identifier: GPL-3.0-only
/**
 * armEdgeRivetPickup — unconditionally raise EDGE_RIVET_ARMED, the set half of a
 * set-then-consume one-shot (the screen-edge test that gates it lives upstream).
 *
 * LIVE-OUT: memory-only — EDGE_RIVET_ARMED := 1.
 */

import { EDGE_RIVET_ARMED } from "./names.js";

export function armEdgeRivetPickup(m) {
  m.mem8[EDGE_RIVET_ARMED] = 0x01;
}
