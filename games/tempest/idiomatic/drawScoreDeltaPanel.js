// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { SCORE_DISPLAY_TIMER, ACTIVE_SLOT, REARM_COUNTER } from "./names.js";
import { buildTextOverlayList } from "./buildTextOverlayList.js";
import { drawSlotShapeWithHeader } from "./drawSlotShapeWithHeader.js";
import { emitCountDigitRun } from "./emitCountDigitRun.js";
import { drawSlotShapeRecord } from "./drawSlotShapeRecord.js";
import { drawHighlightedGlyphRowList } from "./drawHighlightedGlyphRowList.js";

/**
 * drawScoreDeltaPanel — draw the fixed score/status frame, then the highlighted glyph rows. ROM 0xadea.
 *
 * Role in the machine: this composes one panel of the on-screen frame: the fixed text overlay and a
 * chain of fixed shape slots that make up the panel's border/labels, a per-frame countdown tick, and
 * finally a highlighted list of glyph rows keyed by a score-delta value. It is the panel driver that
 * ties the static furniture to the dynamic row list.
 *
 * Behavior: it first builds the text overlay (buildTextOverlayList), then draws the framing shape via
 * drawSlotShapeWithHeader(0xc0, 0x02). It decrements the display countdown SCORE_DISPLAY_TIMER (0x16e)
 * by one and emits its digit run (emitCountDigitRun). It draws marker slot 0x0a, two more headered
 * shapes (0xa6/0x0c and 0x9c/0x0e), and marker slot 0x2c. It then forms the row-selector delta as
 * ACTIVE_SLOT − REARM_COUNTER (0x602 − 0x604, wrapped to a byte) and tail-calls
 * drawHighlightedGlyphRowList, which draws the descending glyph rows and highlights the one whose index
 * matches this delta.
 *
 * Live-out: SCORE_DISPLAY_TIMER ticked down by one; the fixed frame, digit run and glyph-row records
 * appended to the display list; the highlighted row determined by the score delta. Grounding: [seen].
 */
export function drawScoreDeltaPanel(m) {
  const { mem8 } = m;
  buildTextOverlayList(m);                              // static text overlay
  drawSlotShapeWithHeader(m, 0xc0, 0x02);               // framing shape
  mem8[SCORE_DISPLAY_TIMER] = u8(mem8[SCORE_DISPLAY_TIMER] - 1); // tick the countdown (0x16e)
  emitCountDigitRun(m);                                 // draw the countdown's digits
  drawSlotShapeRecord(m, 0x0a);                         // marker slot
  drawSlotShapeWithHeader(m, 0xa6, 0x0c);               // label shape
  drawSlotShapeWithHeader(m, 0x9c, 0x0e);               // label shape
  drawSlotShapeRecord(m, 0x2c);                         // marker slot
  const delta = u8(mem8[ACTIVE_SLOT] - mem8[REARM_COUNTER]); // 0x602 - 0x604: which row to highlight
  return drawHighlightedGlyphRowList(m, delta);         // draw the rows, highlighting that one
}
