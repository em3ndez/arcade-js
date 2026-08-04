// SPDX-License-Identifier: GPL-3.0-only
/**
 * armEdgeRivetPickup — raise the edge-item pickup latch (EDGE_RIVET_ARMED := 1).  ROM 0x1A4B.
 *
 * The "arm" half of a two-pass, set-then-consume latch driven by sub_1a33 (the edge
 * item pickup, ROM 0x1A33), which runs every in-game frame from loc_197a's update
 * cascade. sub_1a33 reads the player's X and, when the player stands on a screen-EDGE
 * column (MARIO_X == 0x4B or 0xB3), tail-jumps here. This routine unconditionally
 * raises EDGE_RIVET_ARMED = 1 and returns. On a LATER frame — once the player is no
 * longer on the exact edge — sub_1a33 takes its other path (`ld a,(0x6291) / dec a`):
 * it processes the pickup only if the flag was 1, and the pickup handler's first act
 * (ROM 0x1A51, with A == 0) DISARMS the flag by writing 0 back. So EDGE_RIVET_ARMED is
 * a rivet-scoped one-shot: this routine raises it on the edge-hit frame; sub_1a33
 * consumes and clears it on the following collect frame (clearing a RIVET_PRESENT slot
 * and decrementing RIVETS_LEFT).
 *
 * The store is UNCONDITIONAL — the edge test that decides whether this runs at all
 * lives in the caller, not here. A LEAF: reads nothing, calls nothing, writes exactly
 * one byte.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1a4b.test.js.
 * GATE:     crafted-entry — UNREACHABLE in attract (0x1a4b dispatched 0x over 2500
 *           frames, asserted; the caller sub_1a33 runs ~1478x but the demo player never
 *           stands on an exact edge column, the only way here). Straight-line, no
 *           data-dependent branch, reads nothing, so its one path is proven from a real
 *           captured entry (at sub_1a33's dispatch) and swept over all 256 prior values
 *           of EDGE_RIVET_ARMED — the write is unconditional, so every prior value ends 1.
 * LIVE-OUT: memory-only — EDGE_RIVET_ARMED (0x6291) := 1. The oracle also leaves A == 1,
 *           but the sole exit successor (loc_197a's next call, sub_2a85) overwrites A
 *           with `ld a,(0x6215)` before reading it, so A is dead ABI; no flags touched.
 *           (The whole-machine/pixel gate backstops the dead register.)
 * NAMES:    EDGE_RIVET_ARMED (0x6291) — from names.js.
 */

import { EDGE_RIVET_ARMED } from "./names.js";

/**
 * @param {object} m  the machine (uses m.mem only).
 */
export function armEdgeRivetPickup(m) {
  // ld a,0x01 / ld (0x6291),a — raise the latch. Unconditional: the screen-edge test
  // that gates this lives in the caller (sub_1a33). sub_1a33 consumes + disarms it on
  // a later frame.
  m.mem.write8(EDGE_RIVET_ARMED, 0x01);
}
