// SPDX-License-Identifier: GPL-3.0-only
import { loc_0a93 } from "./loc_0a93.js";
import { TYPE_PACE_COUNT } from "./names.js";

// Type one draw-script record: byte count comes from TYPE_PACE_COUNT; source `de` and dest `hl` are the
// record the caller just fetched (threaded explicitly). Generator; memory-only.
export function* loc_184c(m, de, hl) {
  yield* loc_0a93(m, de, m.mem8[TYPE_PACE_COUNT], hl);
}
