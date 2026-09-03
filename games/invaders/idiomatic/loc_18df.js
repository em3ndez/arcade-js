// SPDX-License-Identifier: GPL-3.0-only
import { loc_0aea } from "./loc_0aea.js";
import { loc_20cf } from "./names.js";

// Attract-cycle join point (entered from boot init and from the round-teardown loop-back): set the
// round/mode state cell, then delegate to the attract setup + demo loop so its per-frame yields reach
// the engine. Generator; memory-only.
export function* loc_18df(m) {
  m.mem8[loc_20cf] = 0x08;
  yield* loc_0aea(m);
}
