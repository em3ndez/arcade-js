// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { emitBlankVectorWordTag70 } from "./emitBlankVectorWordTag70.js";
import { emitColorStatIfChanged } from "./emitColorStatIfChanged.js";
import { drawSlotShapeRecord } from "./drawSlotShapeRecord.js";
import { emitFixedVectorWord } from "./emitFixedVectorWord.js";
import { drawOverlayFrame } from "./drawOverlayFrame.js";
import { buildMarkerRowVectorList } from "./buildMarkerRowVectorList.js";
import { buildTextBufferDigitString } from "./buildTextBufferDigitString.js";
import { emitCoordinateVectorWord } from "./emitCoordinateVectorWord.js";
import { emitTableValueDigitRun } from "./emitTableValueDigitRun.js";
import {
  VG_LAST_STAT, STATUS_FLAGS, FRAME_COUNTER, PHASE_COUNTER, loc_a2, NIBBLE_GLYPH_TABLE, VEC_SNAPSHOT_MIRROR_A, VEC_SNAPSHOT_MIRROR_B,
  ACTIVE_SLOT_COUNT, loc_43, loc_44, loc_45, GAME_MODE, WORK_PTR_LO, WORK_PTR_HI, GLYPH_LIST_BUF_OFS, MIRROR_COPY_BUF_OFS,
  DECIMAL_MODE_FLAG, SELFCHECK_XOR_BYTES, TABLE_CURSOR, loc_61b, CHAR_GLYPH_TABLE, VEC_GLYPH_BUFFER, SPIKED_SEGMENT_COUNT, loc_3d, loc_102,
} from "./names.js";

/**
 * buildTextOverlayList — compose the per-frame text/marker overlay into vector buffer 0x2f60. ROM 0xa8b4.
 *
 * Role in the machine: this is the routine that lays down the on-screen text and marker glyphs each
 * frame — the score/status header and the little indicator markers that ride over the tube. It emits
 * a run of vector item records into display RAM: it mirrors one control byte, refreshes the colour
 * header, and — when the display is in a live mode — chooses a marker slot shape from the current
 * game state, draws it, and stamps a glyph snapshot into two mirror cells so later passes read a
 * stable copy of it.
 *
 * Behavior: it seeds VG_LAST_STAT=0x01, then emits the blank/tag-70 lead word (emitBlankVectorWordTag70)
 * and the colour-stat word (emitColorStatIfChanged). When STATUS_FLAGS bit7 is clear (display live) it
 * picks a marker index from the frame/phase state — FRAME_COUNTER bit5 set → 0x00, else a zero
 * PHASE_COUNTER or loc_a2 bit7 → 0x22, else 0x06 — draws that slot shape, emits the fixed word, and
 * copies NIBBLE_GLYPH_TABLE into both VEC_SNAPSHOT_MIRROR_A and _B before drawing the overlay frame.
 * It always emits the base marker-row list; a second row follows only when the flag source is nonzero
 * (ACTIVE_SLOT_COUNT under the safe flag, otherwise loc_43|loc_44|loc_45). Off the "safe" mode
 * (GAME_MODE != 0x04) it rebuilds the digit string, folds the 11-byte SELFCHECK_XOR_BYTES table into
 * one checksum byte at DECIMAL_MODE_FLAG (seed 0xa7), and copies three doubled-index CHAR_GLYPH_TABLE
 * entries into a strided VEC_GLYPH_BUFFER mirror, leaving TABLE_CURSOR=0xff. Finally it emits the
 * framing coordinate word, optionally a spiked-segment marker (SPIKED_SEGMENT_COUNT bit7), and — only
 * in the active phase (GAME_MODE==0x18 with STATUS_FLAGS bit7 set) — draws the loc_102-indexed slot
 * pair and two trailing markers.
 *
 * Live-out: the vector item records appended to buffer 0x2f60, VG_LAST_STAT, the two snapshot mirror
 * cells VEC_SNAPSHOT_MIRROR_A/_B, DECIMAL_MODE_FLAG (the folded checksum), the strided VEC_GLYPH_BUFFER
 * mirror, and TABLE_CURSOR. Grounding: [seen].
 */
export function buildTextOverlayList(m) {
  const { mem8 } = m;
  mem8[VG_LAST_STAT] = 0x01;         // mirror the control byte into the last-stat cell
  emitBlankVectorWordTag70(m, 0x01); // lead the list with the blank/tag-70 word
  emitColorStatIfChanged(m, 0x05);   // refresh the colour header if it moved

  // Display live (safe-mode flag clear): pick and draw a marker slot, then snapshot a glyph.
  if (!(mem8[STATUS_FLAGS] & 0x80)) {
    let idx;
    if (mem8[FRAME_COUNTER] & 0x20) idx = 0x00;        // even/odd frame phase
    else if (mem8[PHASE_COUNTER] === 0) idx = 0x22;    // phase idle
    else if (mem8[loc_a2] & 0x80) idx = 0x22;          // or the loc_a2 sign flag
    else idx = 0x06;
    drawSlotShapeRecord(m, idx);
    emitFixedVectorWord(m);
    const snap = mem8[NIBBLE_GLYPH_TABLE];
    mem8[VEC_SNAPSHOT_MIRROR_A] = snap;                // duplicate the glyph into two mirror cells
    mem8[VEC_SNAPSHOT_MIRROR_B] = snap;
    drawOverlayFrame(m);
  }

  buildMarkerRowVectorList(m, 0x01, 0x00);             // always emit the base marker row

  // A second list follows only when the flag source is nonzero.
  const flag = (mem8[STATUS_FLAGS] & 0x80)
    ? mem8[ACTIVE_SLOT_COUNT]
    : mem8[loc_43] | mem8[loc_44] | mem8[loc_45];
  if (flag !== 0) buildMarkerRowVectorList(m, 0x01, 0x01);

  // Off the safe mode: rebuild the digit string, a checksum byte, and a 3-entry glyph mirror.
  if (mem8[GAME_MODE] !== 0x04) {
    mem8[WORK_PTR_LO] = 0x1d;                          // point the work pointer at the digit source
    mem8[WORK_PTR_HI] = 0x07;
    buildTextBufferDigitString(m, mem8[GLYPH_LIST_BUF_OFS]);
    // Fold a fixed 11-byte table into one checksum byte (seed 0xa7).
    let cksum = 0xa7;
    for (let y = 0x0a; y >= 0; y--) cksum ^= mem8[u16(SELFCHECK_XOR_BYTES + y)];
    mem8[DECIMAL_MODE_FLAG] = cksum;
    // Copy three source entries (doubled index) into a strided mirror.
    let dst = mem8[MIRROR_COPY_BUF_OFS];
    for (let c = 2; c >= 0; c--) {
      const y = (mem8[u16(loc_61b + c)] << 1) & 0xff;  // doubled table index
      mem8[u16(VEC_GLYPH_BUFFER + dst)] = mem8[u16(CHAR_GLYPH_TABLE + y)];
      dst = (dst + 2) & 0xff;                          // stride the destination by two
    }
    mem8[TABLE_CURSOR] = 0xff;
  }

  emitCoordinateVectorWord(m, 0x2f, 0x60);             // emit the framing coordinate word

  if (mem8[SPIKED_SEGMENT_COUNT] & 0x80) drawSlotShapeRecord(m, 0x36); // spiked-segment marker

  // Trailing slot pair + two markers only in the active phase.
  if (mem8[GAME_MODE] !== 0x18) return;
  if (!(mem8[STATUS_FLAGS] & 0x80)) return;

  // Draw the loc_102-indexed slot and its digit run when that slot is live.
  if (mem8[u16(loc_102 + mem8[loc_3d])] !== 0) {
    drawSlotShapeRecord(m, 0x30);
    emitTableValueDigitRun(m, mem8[u16(loc_102 + mem8[loc_3d])]);
  }
  drawSlotShapeRecord(m, 0x3a);                        // two trailing markers
  drawSlotShapeRecord(m, 0x38);
}
