// SPDX-License-Identifier: GPL-3.0-only
import { typePacedSpriteRun } from "./typePacedSpriteRun.js";
import { TYPE_PACE_COUNT } from "./names.js";

// Type one draw-script record: byte count comes from TYPE_PACE_COUNT; source `de` and dest `hl` are the
// record the caller just fetched (threaded explicitly). Generator; memory-only.
export function* typeDrawScriptRecord(m, de, hl) {
  yield* typePacedSpriteRun(m, de, m.mem8[TYPE_PACE_COUNT], hl);
}
