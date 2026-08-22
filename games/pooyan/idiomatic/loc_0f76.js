// SPDX-License-Identifier: GPL-3.0-only
import { SIREN_ENABLE_GATE, ROUND_COUNTER } from "./names.js";
import { loc_0ea2 } from "./loc_0ea2.js";
import { loc_0fc3 } from "./loc_0fc3.js";
/**
 * loc_0f76 — draw the warning-siren tile run while the siren gate is clear.
 *
 * When the siren-enable gate is nonzero nothing is drawn. Otherwise it picks a base tile
 * offset by the round counter's low bit, appends that tile to the command ring, then hands
 * off to the shared run helper that appends the completing tile run.
 *
 * LIVE-OUT: A. On the disabled path A = the (nonzero) gate byte; on the draw path A = the advanced
 * ring cursor the append chain leaves (0 when the ring gates are closed), via the return-assignment.
 */

const DRAW_TILE_BASE = 0x1a; // base tile; the round counter's low bit picks this or the next

export function loc_0f76(m) {
  const { mem8 } = m;
  const gate = mem8[SIREN_ENABLE_GATE];
  if (gate !== 0) return (m.regs.a = gate); // siren disabled: nothing to draw

  const tile = DRAW_TILE_BASE + (mem8[ROUND_COUNTER] & 0x01);
  loc_0ea2(m, tile); // append the tile; the chain leaves the advanced cursor in A
  return loc_0fc3(m); // append the completing run; A = the final cursor
}
