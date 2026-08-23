// SPDX-License-Identifier: GPL-3.0-only
import { loc_20d4 } from "./loc_20d4.js";
import { loc_71ce } from "./loc_71ce.js";

/**
 * loc_71c7 — bonus phase-0 body.
 *
 * Step the eagle/arrow approach state machine, then run the shared per-frame object update.
 * The state machine leaves no register the update reads back, so no bridging is needed
 * between the two.
 *
 * LIVE-OUT: memory only.
 */
export function loc_71c7(m) {
  loc_71ce(m);
  loc_20d4(m);
}
