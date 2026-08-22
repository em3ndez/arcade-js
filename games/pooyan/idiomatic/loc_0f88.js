// SPDX-License-Identifier: GPL-3.0-only
import { loc_0ea2 } from "./loc_0ea2.js";
import { loc_0fc3 } from "./loc_0fc3.js";
/**
 * loc_0f88 — a tile-command trampoline.
 *
 * Append the fixed opening tile through the command-ring helper, then tail-hand the run
 * index to the four-tile run builder, whose result rides straight back out. Both appends
 * are gated inside the helper on the game-active / play-mode state (dropped when idle).
 *
 * LIVE-OUT: A — the advanced ring cursor left by the final append (0 when the gate is closed),
 * set through the tail helper's return-assignment.
 */
const OPEN_TILE = 0x82; // the tile byte emitted first
const RUN_INDEX = 0x1c; // the leading byte of the four-tile run

export function loc_0f88(m) {
  loc_0ea2(m, OPEN_TILE);
  return loc_0fc3(m, RUN_INDEX);
}
