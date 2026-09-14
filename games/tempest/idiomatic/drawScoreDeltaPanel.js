// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { SCORE_DISPLAY_TIMER, ACTIVE_SLOT, REARM_COUNTER } from "./names.js";
import { buildTextOverlayList } from "./buildTextOverlayList.js";
import { drawSlotShapeWithHeader } from "./drawSlotShapeWithHeader.js";
import { emitCountDigitRun } from "./emitCountDigitRun.js";
import { drawSlotShapeRecord } from "./drawSlotShapeRecord.js";
import { drawHighlightedGlyphRowList } from "./drawHighlightedGlyphRowList.js";

// Draw the fixed frame, tick a countdown, then hand a score delta to the row builder.
export function drawScoreDeltaPanel(m) {
  const { mem8 } = m;
  buildTextOverlayList(m);
  drawSlotShapeWithHeader(m, 0xc0, 0x02);
  mem8[SCORE_DISPLAY_TIMER] = u8(mem8[SCORE_DISPLAY_TIMER] - 1);
  emitCountDigitRun(m);
  drawSlotShapeRecord(m, 0x0a);
  drawSlotShapeWithHeader(m, 0xa6, 0x0c);
  drawSlotShapeWithHeader(m, 0x9c, 0x0e);
  drawSlotShapeRecord(m, 0x2c);
  const delta = u8(mem8[ACTIVE_SLOT] - mem8[REARM_COUNTER]);
  return drawHighlightedGlyphRowList(m, delta);
}
