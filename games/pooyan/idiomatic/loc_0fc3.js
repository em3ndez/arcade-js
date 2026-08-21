// SPDX-License-Identifier: GPL-3.0-only
import { loc_0ea2 } from "./loc_0ea2.js";
/**
 * loc_0fc3 — append a four-tile run to the command ring.
 *
 * Appends the caller's byte, then the three fixed tile codes that complete the run, each
 * through the shared append helper. The final append is a tail whose result is returned.
 *
 * LIVE-OUT: A = the advanced ring cursor after the fourth append (0 when the append gates
 * are closed). A survives because AF is not restored across the calls and the caller reads
 * it; set through the helper's return-assignment.
 */

const RUN_TILE_1 = 0x15;
const RUN_TILE_2 = 0x16;
const RUN_TILE_3 = 0x17;

export function loc_0fc3(m, a = m.regs.a) {
  loc_0ea2(m, a);
  loc_0ea2(m, RUN_TILE_1);
  loc_0ea2(m, RUN_TILE_2);
  return loc_0ea2(m, RUN_TILE_3);
}
