// SPDX-License-Identifier: GPL-3.0-only
import { loc_756d } from "./loc_756d.js";
import { loc_7621 } from "./loc_7621.js";
import { loc_6b13 } from "./loc_6b13.js";
import { loc_76af } from "./loc_76af.js";
import { loc_02ef } from "./loc_02ef.js";

/**
 * loc_755d — dispatch state 2: the per-frame gameplay driver.
 *
 * Runs, in order, the projectile spawner, the arrow/object mover, the eagle two-tile blitter, the
 * blink-timer tile swap, and the per-frame sprite display-list rebuild, then returns. The spawner's
 * own caller-skip is handled internally, so it returns normally here. LIVE-OUT: none — a void driver.
 */

export function loc_755d(m) {
  loc_756d(m); // projectile spawner
  loc_7621(m); // arrow / object mover
  loc_6b13(m); // eagle two-tile blitter
  loc_76af(m); // blink-timer tile swap
  loc_02ef(m); // rebuild the sprite display list
}
