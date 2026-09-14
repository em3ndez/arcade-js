// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  loc_2b, COORD_LIST_PTR_HI, loc_2e, loc_2f, loc_30, SAVED_INDEX2, TABLE_CURSOR,
  PROJ_PT_Y, OBJ_DEPTH, PROJ_PT_X, CLAMP_TALLY, RUN_SIZE, DEPTH_LO, DEPTH_HI,
  PROJ_Y_LO, PROJ_Y_HI, PROJ_X_LO, PROJ_X_HI, PREV_Y_LO, PREV_Y_HI, PREV_X_LO, PREV_X_HI,
  VG_RECORD_HEADER, DRAW_CURSOR_LO, SEG_SPREAD_A_LO, SEG_SPREAD_A_LO_1, SEG_SPREAD_A_LO_2, SEG_SPREAD_A_LO_3, SEG_SPREAD_A_LO_4, SEG_SPREAD_A_LO_5, SEG_SPREAD_A_LO_6, SEG_SPREAD_A_LO_7,
  SEG_SPREAD_A_HI, SEG_SPREAD_A_HI_2, SEG_SPREAD_A_HI_3, SEG_SPREAD_A_HI_4, SEG_SPREAD_A_HI_5, SEG_SPREAD_A_HI_6, SEG_SPREAD_A_HI_7,
  SEG_SPREAD_B_LO, SEG_SPREAD_B_LO_1, SEG_SPREAD_B_LO_2, SEG_SPREAD_B_LO_3, SEG_SPREAD_B_LO_4, SEG_SPREAD_B_LO_5, SEG_SPREAD_B_LO_6, SEG_SPREAD_B_LO_7,
  SEG_SPREAD_B_HI, SEG_SPREAD_B_HI_2, SEG_SPREAD_B_HI_3, SEG_SPREAD_B_HI_4, SEG_SPREAD_B_HI_5, SEG_SPREAD_B_HI_6, SEG_SPREAD_B_HI_7, DRAW_RECORD_COUNT, SEG_DELTA_A_SIGN, SEG_DELTA_B_SIGN, loc_9e, DRAW_CURSOR_OFFSET,
  SEG_BASE_X, SEG_BASE_Y, SEG_RECORD_COUNT, SEG_PACK_CURSOR, SEG_PACKED_BYTE, SEG_HEADER_BYTE,
} from "./names.js";
import { projectPointThroughMathbox } from "./projectPointThroughMathbox.js";
import { layHeaderAndBuildRecord } from "./layHeaderAndBuildRecord.js";
import { loc_df4c } from "./loc_df4c.js";
import { advanceDisplayCursor } from "./advanceDisplayCursor.js";
import { loc_df6c } from "./loc_df6c.js";

// Full entry: capture the source/next-corner endpoints for a segment, seed the run counters,
// then hand off to the shared builder.
export function drawTubeRimSegmentFromCorner(m, a = m.regs.a, y = m.regs.y) {
  const { mem8 } = m;
  mem8[SAVED_INDEX2] = a;
  mem8[PROJ_PT_Y] = mem8[u16(SEG_BASE_X + y)];
  mem8[PROJ_PT_X] = mem8[u16(SEG_BASE_Y + y)];
  mem8[loc_2f] = mem8[OBJ_DEPTH];
  const nc = (y + 1) & 0x0f;
  mem8[loc_2e] = mem8[u16(SEG_BASE_X + nc)];
  mem8[loc_30] = mem8[u16(SEG_BASE_Y + nc)];
  mem8[CLAMP_TALLY] = 0x00;
  mem8[RUN_SIZE] = 0x04;
  return emitTubeRimSegmentVectors(m, mem8[SAVED_INDEX2]);
}

// Shared builder (also entered directly): early-out unless active, transform both endpoints,
// form two clamped signed deltas, expand a fivefold spread table, then emit N four-byte
// records into the ($74) cursor and advance it.
export function emitTubeRimSegmentVectors(m, corner = m.regs.y) {
  const { mem8, mem16 } = m;
  if (!(mem8[DEPTH_LO] & 0x80)) {
    if (mem8[OBJ_DEPTH] < mem8[DEPTH_HI]) return;
  }
  mem8[DRAW_RECORD_COUNT] = mem8[u16(SEG_RECORD_COUNT + corner)];
  mem8[TABLE_CURSOR] = mem8[u16(SEG_PACK_CURSOR + corner)];
  loc_df4c(m, 0x08, mem8[loc_9e]);
  projectPointThroughMathbox(m);
  layHeaderAndBuildRecord(m, 0x61);
  mem8[PROJ_PT_Y] = mem8[loc_2e];
  mem8[OBJ_DEPTH] = mem8[loc_2f];
  mem8[PROJ_PT_X] = mem8[loc_30];
  projectPointThroughMathbox(m);
  loc_df6c(m, mem8[RUN_SIZE], mem8[CLAMP_TALLY]);

  // delta 1 -> clamped magnitude in $79, sign high byte in $9b
  {
    const d = mem8[PROJ_Y_LO] - mem8[PREV_Y_LO];
    mem8[SEG_SPREAD_A_LO_1] = d;
    mem8[SEG_DELTA_A_SIGN] = mem8[PROJ_Y_HI] - mem8[PREV_Y_HI] - (d < 0 ? 1 : 0);
    if (mem8[SEG_DELTA_A_SIGN] & 0x80) {
      if (mem8[SEG_DELTA_A_SIGN] === 0xff) mem8[SEG_SPREAD_A_LO_1] = mem8[SEG_SPREAD_A_LO_1] === 0 ? 0xff : 256 - mem8[SEG_SPREAD_A_LO_1];
      else mem8[SEG_SPREAD_A_LO_1] = 0xff;
    } else if (mem8[SEG_DELTA_A_SIGN] !== 0) {
      mem8[SEG_SPREAD_A_LO_1] = 0xff;
    }
  }
  // delta 2 -> clamped magnitude in $89, sign high byte in $9d
  {
    const d = mem8[PROJ_X_LO] - mem8[PREV_X_LO];
    mem8[SEG_SPREAD_B_LO_1] = d;
    mem8[SEG_DELTA_B_SIGN] = mem8[PROJ_X_HI] - mem8[PREV_X_HI] - (d < 0 ? 1 : 0);
    if (mem8[SEG_DELTA_B_SIGN] & 0x80) {
      if (mem8[SEG_DELTA_B_SIGN] === 0xff) mem8[SEG_SPREAD_B_LO_1] = 256 - mem8[SEG_SPREAD_B_LO_1];
      else mem8[SEG_SPREAD_B_LO_1] = 0xff;
    } else if (mem8[SEG_DELTA_B_SIGN] !== 0) {
      mem8[SEG_SPREAD_B_LO_1] = 0xff;
    }
  }

  // fivefold spread: two 24-bit chains ($82/$83/$84... and $92/$93/$94...) built from $79 and $89
  let a = 0, cf = 0;
  mem8[SEG_SPREAD_A_HI_2] = 0x00;
  mem8[SEG_SPREAD_B_HI_2] = 0x00;
  a = mem8[SEG_SPREAD_A_LO_1]; cf = (a >> 7) & 1; a = (a << 1) & 0xff;
  { const t = ((mem8[SEG_SPREAD_A_HI_2] << 1) | cf) & 0xff; cf = (mem8[SEG_SPREAD_A_HI_2] >> 7) & 1; mem8[SEG_SPREAD_A_HI_2] = t; }
  mem8[SEG_SPREAD_A_LO_2] = a;
  cf = (a >> 7) & 1; a = (a << 1) & 0xff;
  mem8[SEG_SPREAD_A_LO_4] = a;
  a = mem8[SEG_SPREAD_A_HI_2]; { const c0 = cf; cf = (a >> 7) & 1; a = ((a << 1) | c0) & 0xff; }
  mem8[SEG_SPREAD_A_HI_4] = a;
  a = mem8[SEG_SPREAD_A_LO_4]; { const s = a + mem8[SEG_SPREAD_A_LO_1] + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; }
  mem8[SEG_SPREAD_A_LO_5] = a;
  a = mem8[SEG_SPREAD_A_HI_4]; { const s = a + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; }
  mem8[SEG_SPREAD_A_HI_5] = a;
  a = mem8[SEG_SPREAD_A_LO_2]; { const s = a + mem8[SEG_SPREAD_A_LO_1] + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; }
  mem8[SEG_SPREAD_A_LO_3] = a;
  a = mem8[SEG_SPREAD_A_HI_2]; { const s = a + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; }
  mem8[SEG_SPREAD_A_HI_3] = a;
  mem8[SEG_SPREAD_A_HI_6] = a;
  a = mem8[SEG_SPREAD_A_LO_3]; cf = (a >> 7) & 1; a = (a << 1) & 0xff;
  mem8[SEG_SPREAD_A_LO_6] = a;
  { const t = ((mem8[SEG_SPREAD_A_HI_6] << 1) | cf) & 0xff; cf = (mem8[SEG_SPREAD_A_HI_6] >> 7) & 1; mem8[SEG_SPREAD_A_HI_6] = t; }
  { const s = a + mem8[SEG_SPREAD_A_LO_1] + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; }
  mem8[SEG_SPREAD_A_LO_7] = a;
  a = mem8[SEG_SPREAD_A_HI_6]; { const s = a + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; }
  mem8[SEG_SPREAD_A_HI_7] = a;
  a = mem8[SEG_SPREAD_B_LO_1]; cf = (a >> 7) & 1; a = (a << 1) & 0xff;
  { const t = ((mem8[SEG_SPREAD_B_HI_2] << 1) | cf) & 0xff; cf = (mem8[SEG_SPREAD_B_HI_2] >> 7) & 1; mem8[SEG_SPREAD_B_HI_2] = t; }
  mem8[SEG_SPREAD_B_LO_2] = a;
  cf = (a >> 7) & 1; a = (a << 1) & 0xff;
  mem8[SEG_SPREAD_B_LO_4] = a;
  a = mem8[SEG_SPREAD_B_HI_2]; { const c0 = cf; cf = (a >> 7) & 1; a = ((a << 1) | c0) & 0xff; }
  mem8[SEG_SPREAD_B_HI_4] = a;
  a = mem8[SEG_SPREAD_B_LO_4]; { const s = a + mem8[SEG_SPREAD_B_LO_1] + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; }
  mem8[SEG_SPREAD_B_LO_5] = a;
  a = mem8[SEG_SPREAD_B_HI_4]; { const s = a + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; }
  mem8[SEG_SPREAD_B_HI_5] = a;
  a = mem8[SEG_SPREAD_B_LO_2]; { const s = a + mem8[SEG_SPREAD_B_LO_1] + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; }
  mem8[SEG_SPREAD_B_LO_3] = a;
  a = mem8[SEG_SPREAD_B_HI_2]; { const s = a + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; }
  mem8[SEG_SPREAD_B_HI_3] = a;
  mem8[SEG_SPREAD_B_HI_6] = a;
  a = mem8[SEG_SPREAD_B_LO_3]; cf = (a >> 7) & 1; a = (a << 1) & 0xff;
  mem8[SEG_SPREAD_B_LO_6] = a;
  { const t = ((mem8[SEG_SPREAD_B_HI_6] << 1) | cf) & 0xff; cf = (mem8[SEG_SPREAD_B_HI_6] >> 7) & 1; mem8[SEG_SPREAD_B_HI_6] = t; }
  { const s = a + mem8[SEG_SPREAD_B_LO_1] + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; }
  mem8[SEG_SPREAD_B_LO_7] = a;
  a = mem8[SEG_SPREAD_B_HI_6]; { const s = a + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; }
  mem8[SEG_SPREAD_B_HI_7] = a;
  mem8[DRAW_CURSOR_OFFSET] = 0x00;

  // emit $99 four-byte records: per record pick a header, decode a packed corner byte, then
  // combine the spread offsets by the packed sign bits into a rotated point pair.
  do {
    const yTab = mem8[TABLE_CURSOR];
    let header = mem8[u16(SEG_HEADER_BYTE + yTab)];
    if (header === 1) header = 0xc0;
    mem8[VG_RECORD_HEADER] = header;
    const packed = mem8[u16(SEG_PACKED_BYTE + yTab)];
    mem8[COORD_LIST_PTR_HI] = packed;
    mem8[TABLE_CURSOR] = yTab + 2;
    const dbl = (packed << 1) & 0xff;
    mem8[loc_2b] = dbl;
    const yLo = packed & 0x07;
    const xHi = (dbl >> 4) & 0x07;

    // point A low/high, optionally negated by $9b's sign
    if ((dbl ^ mem8[SEG_DELTA_A_SIGN]) & 0x80) {
      const lo = (~mem8[u16(SEG_SPREAD_A_LO + yLo)] & 0xff) + 1;
      mem8[PROJ_Y_LO] = lo;
      mem8[PROJ_Y_HI] = (~mem8[u16(SEG_SPREAD_A_HI + yLo)] & 0xff) + (lo > 0xff ? 1 : 0);
    } else {
      mem8[PROJ_Y_LO] = mem8[u16(SEG_SPREAD_A_LO + yLo)];
      mem8[PROJ_Y_HI] = mem8[u16(SEG_SPREAD_A_HI + yLo)];
    }
    // combine with the x offset by $9d's sign
    if (!((mem8[COORD_LIST_PTR_HI] ^ mem8[SEG_DELTA_B_SIGN]) & 0x80)) {
      const d = mem8[PROJ_Y_LO] - mem8[u8(SEG_SPREAD_B_LO + xHi)];
      mem8[PROJ_Y_LO] = d;
      mem8[PROJ_Y_HI] = mem8[PROJ_Y_HI] - mem8[u8(SEG_SPREAD_B_HI + xHi)] - (d < 0 ? 1 : 0);
    } else {
      const s = mem8[u8(SEG_SPREAD_B_LO + xHi)] + mem8[PROJ_Y_LO];
      mem8[PROJ_Y_LO] = s;
      mem8[PROJ_Y_HI] = mem8[u8(SEG_SPREAD_B_HI + xHi)] + mem8[PROJ_Y_HI] + (s > 0xff ? 1 : 0);
    }
    // point B low/high, optionally negated by $9d's sign
    if ((dbl ^ mem8[SEG_DELTA_B_SIGN]) & 0x80) {
      const lo = (~mem8[u16(SEG_SPREAD_B_LO + yLo)] & 0xff) + 1;
      mem8[PROJ_X_LO] = lo;
      mem8[PROJ_X_HI] = (~mem8[u16(SEG_SPREAD_B_HI + yLo)] & 0xff) + (lo > 0xff ? 1 : 0);
    } else {
      mem8[PROJ_X_LO] = mem8[u16(SEG_SPREAD_B_LO + yLo)];
      mem8[PROJ_X_HI] = mem8[u16(SEG_SPREAD_B_HI + yLo)];
    }
    // combine with the y offset by $9b's sign
    if (!((mem8[COORD_LIST_PTR_HI] ^ mem8[SEG_DELTA_A_SIGN]) & 0x80)) {
      const s = mem8[PROJ_X_LO] + mem8[u8(SEG_SPREAD_A_LO + xHi)];
      mem8[PROJ_X_LO] = s;
      mem8[PROJ_X_HI] = mem8[PROJ_X_HI] + mem8[u8(SEG_SPREAD_A_HI + xHi)] + (s > 0xff ? 1 : 0);
    } else {
      const d = mem8[PROJ_X_LO] - mem8[u8(SEG_SPREAD_A_LO + xHi)];
      mem8[PROJ_X_LO] = d;
      mem8[PROJ_X_HI] = mem8[PROJ_X_HI] - mem8[u8(SEG_SPREAD_A_HI + xHi)] - (d < 0 ? 1 : 0);
    }

    let yy = mem8[DRAW_CURSOR_OFFSET];
    const base = mem16[DRAW_CURSOR_LO];
    mem8[u16(base + yy)] = mem8[PROJ_X_LO]; yy = (yy + 1) & 0xff;
    mem8[u16(base + yy)] = mem8[PROJ_X_HI] & 0x1f; yy = (yy + 1) & 0xff;
    mem8[u16(base + yy)] = mem8[PROJ_Y_LO]; yy = (yy + 1) & 0xff;
    mem8[u16(base + yy)] = (mem8[PROJ_Y_HI] & 0x1f) | mem8[VG_RECORD_HEADER]; yy = (yy + 1) & 0xff;
    mem8[DRAW_CURSOR_OFFSET] = yy;
    mem8[DRAW_RECORD_COUNT] = mem8[DRAW_RECORD_COUNT] - 1;
  } while (mem8[DRAW_RECORD_COUNT] !== 0);

  advanceDisplayCursor(m, (mem8[DRAW_CURSOR_OFFSET] - 1) & 0xff);
}
