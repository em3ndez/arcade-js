// SPDX-License-Identifier: GPL-3.0-only
import { copyDisplayTilesIntoActorRecords } from "./copyDisplayTilesIntoActorRecords.js";
/**
 * loc_250f — shape-loader prologue: fix the record stride/count (four) then delegate to the shared
 * tile-copier. LIVE-OUT (inherited): IX past the run, B = 0, HL = board-clear flag, A = 0 (plain path).
 */
const RECORD_STRIDE = 0x18;
const RECORD_COUNT = 0x04;

export function loc_250f(m, shapeTable = m.regs.hl, ix = m.regs.ix) {
  return copyDisplayTilesIntoActorRecords(m, shapeTable, RECORD_COUNT, RECORD_STRIDE, ix, RECORD_STRIDE & 0xff);
}
