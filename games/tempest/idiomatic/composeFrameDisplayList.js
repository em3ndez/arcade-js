// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  GAME_MODE, STATUS_FLAGS, TABLE_CURSOR, WORK_PTR_LO, WORK_PTR_HI, loc_3d, ACTIVE_SLOT_COUNT,
  loc_43, loc_44, loc_45, loc_102, SPIKED_SEGMENT_COUNT, DECIMAL_MODE_FLAG, VEC_GLYPH_BUFFER,
  CHAR_GLYPH_TABLE, loc_61b, SELFCHECK_XOR_BYTES, GLYPH_LIST_BUF_OFS, MIRROR_COPY_BUF_OFS,
} from "./names.js";
import { drawOverlayFrame } from "./drawOverlayFrame.js";
import { buildMarkerRowVectorList } from "./buildMarkerRowVectorList.js";
import { buildTextBufferDigitString } from "./buildTextBufferDigitString.js";
import { emitCoordinateVectorWord } from "./emitCoordinateVectorWord.js";
import { drawSlotShapeRecord } from "./drawSlotShapeRecord.js";
import { emitTableValueDigitRun } from "./emitTableValueDigitRun.js";

/**
 * composeFrameDisplayList — assemble one frame's full vector display list. ROM 0xa8e7.
 *
 * Role in the machine: the primary per-frame display-list composer. Tempest's screen is a vector list the
 * display processor walks each frame; this routine lays down that list in order — the base overlay, the
 * marker rows (score / status), a periodically rebuilt self-check byte and mirror table, and finally the
 * mode-specific shape slots (the extra decorations shown on the level/high-score screens). Draw order here is
 * the on-screen z-order, so the sequence of calls is load-bearing.
 *
 * Behavior, in order:
 *  - drawOverlayFrame draws the recurring base overlay; buildMarkerRowVectorList(0x01, 0x00) emits the first
 *    marker row.
 *  - Second marker row is conditional. When STATUS_FLAGS ($05) bit7 is set the gate is ACTIVE_SLOT_COUNT
 *    ($3e); otherwise it is the OR of loc_43|loc_44|loc_45. A nonzero gate means "emit the second row."
 *  - Unless GAME_MODE ($00) == 0x04 (a mode that skips the rebuild): point the work pointer at $071d, build
 *    the glyph/digit text buffer, then rebuild the self-check byte ($16c) by XOR-folding 0xa7 over the eleven
 *    bytes at SELFCHECK_XOR_BYTES ($aace), and rebuild the strided mirror at VEC_GLYPH_BUFFER ($2f60): three
 *    doubled entries indexed through loc_61b, each glyph copied from CHAR_GLYPH_TABLE, cursor $2c..0 counting
 *    down until it goes negative.
 *  - emitCoordinateVectorWord(0x2f, 0x60) posts the framing coordinate word.
 *  - When SPIKED_SEGMENT_COUNT ($123) bit7 is set, draw slot 0x36.
 *  - Tail decorations only when GAME_MODE == 0x18 AND STATUS_FLAGS bit7 set: if loc_102[loc_3d] is nonzero
 *    draw slot 0x30 and emit its numeric run; then always draw slots 0x3a and 0x38.
 *
 * Live-out: the frame's vector display list (via the draw callees); DECIMAL_MODE_FLAG/$16c := self-check
 * byte; VEC_GLYPH_BUFFER/$2f60 mirror rebuilt; TABLE_CURSOR/$2c left negative; WORK_PTR set to $071d.
 * Grounding: [seen].
 */
export function composeFrameDisplayList(m) {
  const { mem8 } = m;
  drawOverlayFrame(m);                        // base overlay first (bottom of z-order)
  buildMarkerRowVectorList(m, 0x01, 0x00);    // first marker row
  // Second marker row is gated: STATUS_FLAGS bit7 -> ACTIVE_SLOT_COUNT; else OR of loc_43/44/45.
  let skipSecond;
  if (mem8[STATUS_FLAGS] & 0x80) skipSecond = mem8[ACTIVE_SLOT_COUNT] === 0;
  else skipSecond = (mem8[loc_43] | mem8[loc_44] | mem8[loc_45]) === 0;
  if (!skipSecond) buildMarkerRowVectorList(m, 0x01, 0x01); // emit only when the gate is live

  if (mem8[GAME_MODE] !== 0x04) {             // mode 0x04 skips the text/self-check rebuild
    mem8[WORK_PTR_LO] = 0x1d;                 // aim the work pointer at $071d (glyph source)
    mem8[WORK_PTR_HI] = 0x07;
    buildTextBufferDigitString(m, mem8[GLYPH_LIST_BUF_OFS]);
    // Rebuild the self-check byte: XOR-fold 0xa7 over the eleven bytes at $aace.
    let sum = 0xa7;
    for (let y = 0x0a; y >= 0; y--) sum ^= mem8[u16(SELFCHECK_XOR_BYTES + y)];
    mem8[DECIMAL_MODE_FLAG] = sum;            // publish self-check byte $16c
    // Rebuild the strided mirror at $2f60: three doubled glyph entries via loc_61b, cursor $2c..0.
    let x = mem8[MIRROR_COPY_BUF_OFS];
    mem8[TABLE_CURSOR] = 0x02;
    for (;;) {
      const idx = u8(mem8[u16(loc_61b + mem8[TABLE_CURSOR])] << 1);   // doubled table index
      mem8[u16(VEC_GLYPH_BUFFER + x)] = mem8[u16(CHAR_GLYPH_TABLE + idx)]; // copy the glyph out
      x = u8(x + 2);                          // stride the destination by two
      mem8[TABLE_CURSOR] = u8(mem8[TABLE_CURSOR] - 1);
      if (mem8[TABLE_CURSOR] & 0x80) break;   // stop when the cursor goes negative
    }
  }

  emitCoordinateVectorWord(m, 0x2f, 0x60);    // framing coordinate word
  if (mem8[SPIKED_SEGMENT_COUNT] & 0x80) drawSlotShapeRecord(m, 0x36); // spike marker slot
  if (mem8[GAME_MODE] !== 0x18) return;       // tail decorations only in mode 0x18 ...
  if (!(mem8[STATUS_FLAGS] & 0x80)) return;   // ... and only with STATUS_FLAGS bit7 set
  if (mem8[u16(loc_102 + mem8[loc_3d])] !== 0) {
    drawSlotShapeRecord(m, 0x30);             // labelled record + its numeric value
    emitTableValueDigitRun(m, mem8[u16(loc_102 + mem8[loc_3d])]);
  }
  drawSlotShapeRecord(m, 0x3a);               // trailing decoration slots
  drawSlotShapeRecord(m, 0x38);
}
