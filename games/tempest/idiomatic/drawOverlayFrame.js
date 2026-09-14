// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { FRAME_COUNTER, PHASE_COUNTER, DSW1_SNAPSHOT, DSW2_SNAPSHOT, HEARTBEAT_ACCUM_HI, SCORE_DISPLAY_TIMER, DRAW_SLOT_TABLE, OVERLAY_VEC_WORD_B, OVERLAY_VEC_WORD_A } from "./names.js";
import { drawSlotShapeRecord } from "./drawSlotShapeRecord.js";
import { computeDisplayListChecksum } from "./computeDisplayListChecksum.js";
import { emitByteAsBcdDigits } from "./emitByteAsBcdDigits.js";
import { emitCoordinateVectorWord } from "./emitCoordinateVectorWord.js";

// Per-frame draw driver: pick a slot by phase, tick a timer, draw the shared or the
// alternate panel, redraw two fixed slots, clamp a level index, then post an optional word.
export function drawOverlayFrame(m) {
  const { mem8 } = m;
  drawSlotShapeRecord(m, mem8[u16(DRAW_SLOT_TABLE + (mem8[DSW1_SNAPSHOT] & 0x03))]);
  mem8[SCORE_DISPLAY_TIMER]--;
  // Draw the alternate slot only when the phase gate is set and the mode flag is clear.
  if ((mem8[DSW2_SNAPSHOT] & 0x01) !== 0 && (mem8[FRAME_COUNTER] & 0x20) === 0) {
    drawSlotShapeRecord(m, 0x32);
  } else {
    computeDisplayListChecksum(m);
  }
  drawSlotShapeRecord(m, 0x2c);
  drawSlotShapeRecord(m, 0x2e);
  if (mem8[PHASE_COUNTER] >= 0x28) mem8[PHASE_COUNTER] = 0x28; // clamp to the ceiling
  emitByteAsBcdDigits(m, mem8[PHASE_COUNTER]);
  if (mem8[HEARTBEAT_ACCUM_HI] !== 0) emitCoordinateVectorWord(m, mem8[OVERLAY_VEC_WORD_A], mem8[OVERLAY_VEC_WORD_B]);
}
