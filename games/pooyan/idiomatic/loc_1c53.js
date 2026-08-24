// SPDX-License-Identifier: GPL-3.0-only
import { ROUND_COUNTER } from "./names.js";
import { loc_68f8 } from "./loc_68f8.js";
import { runObjectAndSpawnUpdatePass } from "./runObjectAndSpawnUpdatePass.js";
import { loc_02ef } from "./loc_02ef.js";

/**
 * loc_1c53 — per-frame object driver, split on frame parity.
 *
 * On odd frames runs the group-update pass; on even frames runs the spawn-subtree driver. Either
 * way it then rebuilds the sprite display list for the frame.
 *
 * LIVE-OUT: none — a void per-frame driver; the caller reads no register back.
 */
export function loc_1c53(m) {
  if (m.mem8[ROUND_COUNTER] & 0x01) {
    loc_68f8(m); // odd frame
  } else {
    runObjectAndSpawnUpdatePass(m); // even frame
  }
  loc_02ef(m);
}
