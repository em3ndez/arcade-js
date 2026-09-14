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
import { emitTaggedVectorWord } from "./emitTaggedVectorWord.js";
import { advanceDisplayCursor } from "./advanceDisplayCursor.js";
import { emitVectorWordTag70 } from "./emitVectorWordTag70.js";

/**
 * drawTubeRimSegmentFromCorner — set up and emit one tube-rim segment between two lane corners. ROM 0xbda0.
 *
 * Role in the machine: the tube rim is the ring of straight edges joining adjacent lane
 * corners at the tube's near mouth. A rim segment runs from one corner to the next; along it
 * ride the flippers and the segment can pulse/expand. This entry captures a segment's two
 * endpoints from the corner tables, seeds the per-segment run counters, then falls into the
 * shared builder that projects the endpoints and emits the vector records.
 *
 * Behaviour: stash the style/shape selector a in SAVED_INDEX2. Load the source corner y as the
 * first endpoint — SEG_BASE_X+y into PROJ_PT_Y and SEG_BASE_Y+y into PROJ_PT_X — and copy the
 * current OBJ_DEPTH into loc_2f (the depth carried to the second endpoint). Compute the next
 * corner ((y+1)&0x0f, wrapping the 16-corner ring) and load it into loc_2e/loc_30. Seed the
 * clamp tally CLAMP_TALLY=0 and the run size RUN_SIZE=4, then tail into emitTubeRimSegmentVectors
 * with the saved selector.
 *
 * Live-out: PROJ_PT_Y/PROJ_PT_X (first endpoint), loc_2e/loc_30/loc_2f (second endpoint + its
 * depth), CLAMP_TALLY, RUN_SIZE, SAVED_INDEX2 — all consumed by emitTubeRimSegmentVectors.
 *
 * Grounding: [seen].
 */
export function drawTubeRimSegmentFromCorner(m, a = m.regs.a, y = m.regs.y) {
  const { mem8 } = m;
  mem8[SAVED_INDEX2] = a;                        // style/shape selector for the builder
  mem8[PROJ_PT_Y] = mem8[u16(SEG_BASE_X + y)];   // first endpoint from source corner y
  mem8[PROJ_PT_X] = mem8[u16(SEG_BASE_Y + y)];
  mem8[loc_2f] = mem8[OBJ_DEPTH];                // depth carried to the second endpoint
  const nc = (y + 1) & 0x0f;                     // next corner, wrapping the 16-corner ring
  mem8[loc_2e] = mem8[u16(SEG_BASE_X + nc)];     // second endpoint
  mem8[loc_30] = mem8[u16(SEG_BASE_Y + nc)];
  mem8[CLAMP_TALLY] = 0x00;
  mem8[RUN_SIZE] = 0x04;
  return emitTubeRimSegmentVectors(m, mem8[SAVED_INDEX2]);
}

/**
 * emitTubeRimSegmentVectors — project a rim segment's endpoints and emit its vector records. ROM 0xbdcb.
 *
 * Role in the machine: the shared back-end of the rim renderer (also entered directly by the
 * slot-point path). It takes the two endpoints set up by the caller, runs them through the
 * hardware math box (the projection that gives the tube its 3-D perspective), then expands the
 * segment into a spread of parallel offset points so a flipper/rim edge draws as a filled run
 * of vectors rather than a single line. The result is a run of four-byte vector-generator
 * records written to the display cursor ($74).
 *
 * Behaviour, in stages:
 *   1. Depth gate — unless DEPTH_LO bit 7 forces drawing, skip the segment when its depth
 *      OBJ_DEPTH is nearer than the cutoff DEPTH_HI (too close to be visible on the rim).
 *   2. Load this corner's record count (SEG_RECORD_COUNT+corner) and packed-corner cursor
 *      (SEG_PACK_CURSOR+corner); emit the colour word (loc_9e); project the first endpoint,
 *      lay its header record; move the second endpoint (loc_2e/loc_2f/loc_30) into the point
 *      cells, project it too, and emit the run's tag-0x70 word.
 *   3. Two signed deltas — (projected Y - previous Y) and (projected X - previous X), each with
 *      a borrow-corrected high byte (SEG_DELTA_A_SIGN / SEG_DELTA_B_SIGN) and its low magnitude
 *      clamped to 0xff on overflow (SEG_SPREAD_A_LO_1 / SEG_SPREAD_B_LO_1). These are the
 *      segment's direction vector.
 *   4. Fivefold spread — from each delta build a 24-bit chain of scaled multiples
 *      (x1, x2, x4, x5, x3, x6, x7 across the SEG_SPREAD_A_* / SEG_SPREAD_B_* cells) via
 *      shift-and-add, giving seven parallel offsets used to fan the segment out.
 *   5. Record emit — for each of the record-count records: pick a header (SEG_HEADER_BYTE),
 *      decode a packed corner byte (SEG_PACKED_BYTE) into a low index and an x index, combine
 *      the A and B spread offsets with signs from the packed bits and the delta signs into a
 *      rotated point pair, and write the four bytes (X lo, X hi masked, Y lo, Y hi masked | header)
 *      to the cursor. Finally advance the display cursor past the run.
 *
 * Live-out: the run of four-byte records at ($74); DRAW_CURSOR_OFFSET advanced (via
 * advanceDisplayCursor); the SEG_SPREAD and SEG_DELTA sign scratch left populated; the PROJ and PREV
 * point cells left at the projected second endpoint.
 *
 * Grounding: [seen].
 */
export function emitTubeRimSegmentVectors(m, corner = m.regs.y) {
  const { mem8, mem16 } = m;
  // Depth gate: skip the segment if it is nearer than the cutoff, unless DEPTH_LO bit7 forces it.
  if (!(mem8[DEPTH_LO] & 0x80)) {
    if (mem8[OBJ_DEPTH] < mem8[DEPTH_HI]) return;
  }
  mem8[DRAW_RECORD_COUNT] = mem8[u16(SEG_RECORD_COUNT + corner)]; // records to emit for this corner
  mem8[TABLE_CURSOR] = mem8[u16(SEG_PACK_CURSOR + corner)];       // start of this corner's packed table
  emitTaggedVectorWord(m, 0x08, mem8[loc_9e]);   // colour/style word for the run
  projectPointThroughMathbox(m);                 // project the first endpoint
  layHeaderAndBuildRecord(m, 0x61);
  mem8[PROJ_PT_Y] = mem8[loc_2e];                // move in the second endpoint...
  mem8[OBJ_DEPTH] = mem8[loc_2f];
  mem8[PROJ_PT_X] = mem8[loc_30];
  projectPointThroughMathbox(m);                 // ...and project it
  emitVectorWordTag70(m, mem8[RUN_SIZE], mem8[CLAMP_TALLY]);

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

  // fivefold spread: two 24-bit chains ($82/$83/$84... and $92/$93/$94...) built from $79 and $89.
  // Each chain scales the base delta into x1..x7 multiples by a shift-and-add ladder; the carry
  // (cf) threads the multi-byte adds so the high bytes track magnitudes past 0xff.
  // --- chain A (from the Y delta $79) ---
  let a = 0, cf = 0;
  mem8[SEG_SPREAD_A_HI_2] = 0x00;
  mem8[SEG_SPREAD_B_HI_2] = 0x00;
  a = mem8[SEG_SPREAD_A_LO_1]; cf = (a >> 7) & 1; a = (a << 1) & 0xff; // x2 = base<<1
  { const t = ((mem8[SEG_SPREAD_A_HI_2] << 1) | cf) & 0xff; cf = (mem8[SEG_SPREAD_A_HI_2] >> 7) & 1; mem8[SEG_SPREAD_A_HI_2] = t; }
  mem8[SEG_SPREAD_A_LO_2] = a;                         // store x2
  cf = (a >> 7) & 1; a = (a << 1) & 0xff;              // x4 = x2<<1
  mem8[SEG_SPREAD_A_LO_4] = a;
  a = mem8[SEG_SPREAD_A_HI_2]; { const c0 = cf; cf = (a >> 7) & 1; a = ((a << 1) | c0) & 0xff; }
  mem8[SEG_SPREAD_A_HI_4] = a;
  a = mem8[SEG_SPREAD_A_LO_4]; { const s = a + mem8[SEG_SPREAD_A_LO_1] + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; } // x5 = x4 + x1
  mem8[SEG_SPREAD_A_LO_5] = a;
  a = mem8[SEG_SPREAD_A_HI_4]; { const s = a + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; }
  mem8[SEG_SPREAD_A_HI_5] = a;
  a = mem8[SEG_SPREAD_A_LO_2]; { const s = a + mem8[SEG_SPREAD_A_LO_1] + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; } // x3 = x2 + x1
  mem8[SEG_SPREAD_A_LO_3] = a;
  a = mem8[SEG_SPREAD_A_HI_2]; { const s = a + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; }
  mem8[SEG_SPREAD_A_HI_3] = a;
  mem8[SEG_SPREAD_A_HI_6] = a;
  a = mem8[SEG_SPREAD_A_LO_3]; cf = (a >> 7) & 1; a = (a << 1) & 0xff;   // x6 = x3<<1
  mem8[SEG_SPREAD_A_LO_6] = a;
  { const t = ((mem8[SEG_SPREAD_A_HI_6] << 1) | cf) & 0xff; cf = (mem8[SEG_SPREAD_A_HI_6] >> 7) & 1; mem8[SEG_SPREAD_A_HI_6] = t; }
  { const s = a + mem8[SEG_SPREAD_A_LO_1] + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; } // x7 = x6 + x1
  mem8[SEG_SPREAD_A_LO_7] = a;
  a = mem8[SEG_SPREAD_A_HI_6]; { const s = a + cf; cf = s > 0xff ? 1 : 0; a = s & 0xff; }
  mem8[SEG_SPREAD_A_HI_7] = a;
  // --- chain B (from the X delta $89), same x1..x7 ladder ---
  a = mem8[SEG_SPREAD_B_LO_1]; cf = (a >> 7) & 1; a = (a << 1) & 0xff; // x2 = base<<1
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
    const yTab = mem8[TABLE_CURSOR];               // walk the packed corner table two bytes at a time
    let header = mem8[u16(SEG_HEADER_BYTE + yTab)]; // per-record VG header
    if (header === 1) header = 0xc0;               // header 1 is shorthand for the 0xc0 draw-mode
    mem8[VG_RECORD_HEADER] = header;
    const packed = mem8[u16(SEG_PACKED_BYTE + yTab)]; // packed sign/index selector byte
    mem8[COORD_LIST_PTR_HI] = packed;
    mem8[TABLE_CURSOR] = yTab + 2;
    const dbl = (packed << 1) & 0xff;              // doubled copy carries the x sign into bit7
    mem8[loc_2b] = dbl;
    const yLo = packed & 0x07;                     // low 3 bits index the A/B spread for point lo
    const xHi = (dbl >> 4) & 0x07;                 // next 3 bits index the spread for the cross offset

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

    // write the four-byte record: X lo, X hi (10-bit masked), Y lo, Y hi (masked) OR'd with the header
    let yy = mem8[DRAW_CURSOR_OFFSET];
    const base = mem16[DRAW_CURSOR_LO];
    mem8[u16(base + yy)] = mem8[PROJ_X_LO]; yy = (yy + 1) & 0xff;
    mem8[u16(base + yy)] = mem8[PROJ_X_HI] & 0x1f; yy = (yy + 1) & 0xff;   // clamp to 5-bit high
    mem8[u16(base + yy)] = mem8[PROJ_Y_LO]; yy = (yy + 1) & 0xff;
    mem8[u16(base + yy)] = (mem8[PROJ_Y_HI] & 0x1f) | mem8[VG_RECORD_HEADER]; yy = (yy + 1) & 0xff;
    mem8[DRAW_CURSOR_OFFSET] = yy;
    mem8[DRAW_RECORD_COUNT] = mem8[DRAW_RECORD_COUNT] - 1;  // one record done
  } while (mem8[DRAW_RECORD_COUNT] !== 0);

  advanceDisplayCursor(m, (mem8[DRAW_CURSOR_OFFSET] - 1) & 0xff);
}
