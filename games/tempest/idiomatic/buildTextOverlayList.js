// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_df6a } from "./loc_df6a.js";
import { emitColorStatIfChanged } from "./emitColorStatIfChanged.js";
import { drawSlotShapeRecord } from "./drawSlotShapeRecord.js";
import { loc_ab0d } from "./loc_ab0d.js";
import { drawOverlayFrame } from "./drawOverlayFrame.js";
import { buildMarkerRowVectorList } from "./buildMarkerRowVectorList.js";
import { buildTextBufferDigitString } from "./buildTextBufferDigitString.js";
import { emitCoordinateVectorWord } from "./emitCoordinateVectorWord.js";
import { loc_b0c6 } from "./loc_b0c6.js";
import {
  VG_LAST_STAT, STATUS_FLAGS, FRAME_COUNTER, PHASE_COUNTER, loc_a2, NIBBLE_GLYPH_TABLE, VEC_SNAPSHOT_MIRROR_A, VEC_SNAPSHOT_MIRROR_B,
  ACTIVE_SLOT_COUNT, loc_43, loc_44, loc_45, GAME_MODE, WORK_PTR_LO, WORK_PTR_HI, GLYPH_LIST_BUF_OFS, MIRROR_COPY_BUF_OFS,
  DECIMAL_MODE_FLAG, SELFCHECK_XOR_BYTES, TABLE_CURSOR, loc_61b, CHAR_GLYPH_TABLE, VEC_GLYPH_BUFFER, SPIKED_SEGMENT_COUNT, loc_3d, loc_102,
} from "./names.js";

// Per-frame overlay build: mirror one control byte, refresh the header, and when the
// mode byte is live pick a marker slot, draw it, and duplicate a snapshot into two mirror
// cells. Always emit the base list; when the flag word is set emit a second. Off the
// safe mode it rebuilds a checksum plus a 3-entry mirror table. Finally emit the framing
// word and, in the active phase, draw the indexed slot pair and two trailing markers.
export function buildTextOverlayList(m) {
  const { mem8 } = m;
  mem8[VG_LAST_STAT] = 0x01;
  loc_df6a(m, 0x01);
  emitColorStatIfChanged(m, 0x05);

  if (!(mem8[STATUS_FLAGS] & 0x80)) {
    let idx;
    if (mem8[FRAME_COUNTER] & 0x20) idx = 0x00;
    else if (mem8[PHASE_COUNTER] === 0) idx = 0x22;
    else if (mem8[loc_a2] & 0x80) idx = 0x22;
    else idx = 0x06;
    drawSlotShapeRecord(m, idx);
    loc_ab0d(m);
    const snap = mem8[NIBBLE_GLYPH_TABLE];
    mem8[VEC_SNAPSHOT_MIRROR_A] = snap;
    mem8[VEC_SNAPSHOT_MIRROR_B] = snap;
    drawOverlayFrame(m);
  }

  buildMarkerRowVectorList(m, 0x01, 0x00);

  // A second list follows only when the flag source is nonzero.
  const flag = (mem8[STATUS_FLAGS] & 0x80)
    ? mem8[ACTIVE_SLOT_COUNT]
    : mem8[loc_43] | mem8[loc_44] | mem8[loc_45];
  if (flag !== 0) buildMarkerRowVectorList(m, 0x01, 0x01);

  if (mem8[GAME_MODE] !== 0x04) {
    mem8[WORK_PTR_LO] = 0x1d;
    mem8[WORK_PTR_HI] = 0x07;
    buildTextBufferDigitString(m, mem8[GLYPH_LIST_BUF_OFS]);
    // Fold a fixed table into one checksum byte.
    let cksum = 0xa7;
    for (let y = 0x0a; y >= 0; y--) cksum ^= mem8[u16(SELFCHECK_XOR_BYTES + y)];
    mem8[DECIMAL_MODE_FLAG] = cksum;
    // Copy three source entries (doubled index) into a strided mirror.
    let dst = mem8[MIRROR_COPY_BUF_OFS];
    for (let c = 2; c >= 0; c--) {
      const y = (mem8[u16(loc_61b + c)] << 1) & 0xff;
      mem8[u16(VEC_GLYPH_BUFFER + dst)] = mem8[u16(CHAR_GLYPH_TABLE + y)];
      dst = (dst + 2) & 0xff;
    }
    mem8[TABLE_CURSOR] = 0xff;
  }

  emitCoordinateVectorWord(m, 0x2f, 0x60);

  if (mem8[SPIKED_SEGMENT_COUNT] & 0x80) drawSlotShapeRecord(m, 0x36);

  if (mem8[GAME_MODE] !== 0x18) return;
  if (!(mem8[STATUS_FLAGS] & 0x80)) return;

  if (mem8[u16(loc_102 + mem8[loc_3d])] !== 0) {
    drawSlotShapeRecord(m, 0x30);
    loc_b0c6(m, mem8[u16(loc_102 + mem8[loc_3d])]);
  }
  drawSlotShapeRecord(m, 0x3a);
  drawSlotShapeRecord(m, 0x38);
}
