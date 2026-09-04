// SPDX-License-Identifier: GPL-3.0-only
import { serviceVblankObjects } from "./serviceVblankObjects.js";

/**
 * runAttractObjectTail — attract-mode task bit0: re-run the vblank in-game record tail.
 *
 * WHAT IT IS
 *   One of the three arms dispatchAttractTask selects from the TASK_FLAGS bitfield during the attract
 *   demo. This is the bit0 arm: it runs serviceVblankObjects — the shared vblank in-game record tail
 *   (forward the per-frame latch cell, redraw the pending marching alien, walk the vblank object table,
 *   step the saucer timer). Unlike the live in-game entry, the fleet-march sound beat is NOT run first;
 *   this arm goes straight to the record tail.
 *
 * ROLE IN THE MACHINE
 *   Called only from dispatchAttractTask when TASK_FLAGS (0x20c1) bit0 is set. serviceVblankObjects is
 *   the single body both the attract-demo task selector and the live game share, so during the demo the
 *   same per-frame object servicing runs as during play — driving the demo's on-screen action.
 *
 * ROM: composite wrapper — no separate cert entry in names.js. Its callee serviceVblankObjects is the
 * shared vblank record tail described in mechanisms.md §"The in-game main loop and round restarts".
 *
 * LIVE-OUT: whatever serviceVblankObjects leaves (RAM), since this tail-calls it.
 */
export function runAttractObjectTail(m) {
  // Run the shared vblank in-game record tail directly (no fleet-march beat ahead of it).
  return serviceVblankObjects(m);
}
