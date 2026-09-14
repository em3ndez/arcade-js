// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  loc_2e, loc_2f, SAVED_INDEX, SLOT_LOOP_INDEX, TABLE_CURSOR, INPUT_DEBOUNCED, INPUT_EDGE_FLAGS, SPINNER_ACCUM, SPINNER_POT_PREV,
  VG_RECORD_HEADER, SEG_SPREAD_A_LO, SEG_SPREAD_A_LO_5, COIN_FLIP_LATCH, NIBBLE_GLYPH_TABLE, NIBBLE_GLYPH_TABLE_HI,
  MATHBOX_LD_RA_LO, MATHBOX_LD_R7_LO, MATHBOX_LD_R7_HI, POKEY1_AUDF1, POKEY1_AUDC1, POKEY1_AUDF2, POKEY1_AUDC2,
  POKEY2_AUDCTL, POKEY2_POTGO, LED_FLIP_LATCH, POTMARK_WORD_INDEX, COLOR_PAIR_LO, COLOR_PAIR_HI,
} from "./names.js";
import { runMathboxDivide } from "./runMathboxDivide.js";
import { buildPotReadoutVectorList } from "./buildPotReadoutVectorList.js";
import { emitByteBitsAsDigits } from "./emitByteBitsAsDigits.js";
import { loc_dd27 } from "./loc_dd27.js";
import { emitCoordinateVectorWord } from "./emitCoordinateVectorWord.js";
import { emitStrokeWordFromNibblePlusOne } from "./emitStrokeWordFromNibblePlusOne.js";
import { emitScaledByteDigit } from "./emitScaledByteDigit.js";
import { emitScaledCoordinateRecord } from "./emitScaledCoordinateRecord.js";
import { emitVectorHeaderWord, emitVectorWord } from "./emitVectorHeaderWord.js";
import { emitKeyedScaledCoordinateRecord } from "./emitKeyedScaledCoordinateRecord.js";

// Per-frame vector-list emit. When the 16-bit counter loc_2e/loc_2f is nonzero it seeds the POKEY
// operand cells, runs the math-coprocessor scan, and from its result (A/X/Y) decides whether to set
// SEG_SPREAD_A_LO = 0xff (and what byte lands in the POKEY status cell). Then it advances the 15-bit counter
// (inc loc_2e; on wrap inc loc_2f, resetting loc_2f to 0 once bit7 sets), builds the POKEY work word
// from INPUT_DEBOUNCED (= a status byte masked to bits 3..6) and INPUT_EDGE_FLAGS, fires the readout draws, conditionally
// emits the SPINNER_POT_PREV-bit marker with a POKEY mode byte plus a latch write, walks SEG_SPREAD_A_LO_5,x for x=11..0
// (emit per nonzero entry) and SEG_SPREAD_A_LO,x for x=4..0 (each nonzero slot indexed into a coordinate word
// table), then tail-delegates to the colour-pair emitter with the SPINNER_ACCUM-indexed pair and Y = 0xc0.
export function emitReadoutVectorList(m) {
  const { mem8 } = m;

  // Byte written to the POKEY status cell at the join below: 0 when the counter low byte is zero,
  // else 0xff when the scan says "set" or the scan's exit X when it says "clear".
  let a60db = 0x00;

  const a0 = mem8[loc_2e];
  if (a0 !== 0) {
    mem8[MATHBOX_LD_R7_LO] = a0;
    mem8[MATHBOX_LD_RA_LO] = a0;
    const a2f = mem8[loc_2f];
    mem8[MATHBOX_LD_R7_HI] = a2f;
    // math-coprocessor scan(m, a=loc_2f, x=0x00) -> [A, X, Y]
    const [ra, rx, ry] = runMathboxDivide(m, a2f, 0x00);
    let setFF;
    if (ra !== 0x01) setFF = true;          // A != 1
    else if (ry !== 0) setFF = true;        // A == 1, Y != 0
    else if ((rx & 0x80) === 0) setFF = false; // A == 1, Y == 0, X positive
    else setFF = true;                      // A == 1, Y == 0, X negative
    if (setFF) { a60db = 0xff; mem8[SEG_SPREAD_A_LO] = 0xff; }
    else { a60db = rx & 0xff; }
  }

  // clear VG_RECORD_HEADER, advance the 15-bit counter loc_2e/loc_2f.
  mem8[VG_RECORD_HEADER] = 0x00;
  mem8[loc_2e] = mem8[loc_2e] + 1;
  if (mem8[loc_2e] === 0) {
    mem8[loc_2f] = mem8[loc_2f] + 1;
    if (mem8[loc_2f] & 0x80) mem8[loc_2f] = 0x00;
  }

  // POKEY status write, then build the work word.
  mem8[POKEY2_POTGO] = a60db;
  const a4d = mem8[POKEY2_AUDCTL] & 0x78;
  mem8[INPUT_DEBOUNCED] = a4d;
  let x60c1 = 0x00;
  if (a4d !== 0) { mem8[POKEY1_AUDF1] = a4d; x60c1 = 0xa4; }
  mem8[POKEY1_AUDC1] = x60c1;

  const a4e = mem8[INPUT_EDGE_FLAGS];
  let x60c3 = 0x00;
  if (a4e !== 0) { mem8[POKEY1_AUDF2] = a4e << 1; x60c3 = 0xa4; }
  mem8[POKEY1_AUDC2] = x60c3;

  // Draw the spinner/knob readout and the two coordinate marks.
  buildPotReadoutVectorList(m);
  emitByteBitsAsDigits(m, mem8[INPUT_DEBOUNCED], 0xd0, 0xf0); // (m, y=INPUT_DEBOUNCED, a=0xd0, x=0xf0)
  loc_dd27(m, mem8[INPUT_EDGE_FLAGS]);             // (m, y=INPUT_EDGE_FLAGS)

  // Optional SPINNER_POT_PREV-bit marker (POKEY mode byte + a latch write).
  if ((mem8[SPINNER_POT_PREV] & 0x10) !== 0) {
    emitCoordinateVectorWord(m, 0x34, 0x82);
    let yLatch = 0x10;
    const g = mem8[INPUT_DEBOUNCED] & 0x60;
    if (g !== 0) {
      let aMode = g ^ 0x20;
      if (aMode !== 0) { aMode = 0x04; yLatch = 0x08; }
      mem8[LED_FLIP_LATCH] = aMode;
      mem8[COIN_FLIP_LATCH] = yLatch;
    }
  }

  emitCoordinateVectorWord(m, 0x34, 0x92);

  // Table walk SEG_SPREAD_A_LO_5,x for x = 11..0: emit each nonzero entry.
  for (let x = 0x0b; x >= 0; x--) {
    const a = mem8[(SEG_SPREAD_A_LO_5 + x) & 0xff];
    if (a !== 0) {
      mem8[SAVED_INDEX] = a;
      mem8[TABLE_CURSOR] = x;
      emitStrokeWordFromNibblePlusOne(m, x);                        // (m, a=x)
      emitScaledByteDigit(m, mem8[SAVED_INDEX], 0xf4, 0xf4); // (m, a=SAVED_INDEX, y=0xf4, x=0xf4)
      emitScaledCoordinateRecord(m, 0x0c, 0x0c);               // (m, a=0x0c, x=0x0c)
    }
  }

  emitVectorHeaderWord(m);
  emitScaledCoordinateRecord(m, 0x00, 0x16); // (m, a=0x00, x=0x16)

  // Table walk SEG_SPREAD_A_LO,x for x = SLOT_LOOP_INDEX = 4..0: each nonzero slot indexed into the coordinate word table.
  mem8[SLOT_LOOP_INDEX] = 0x04;
  do {
    const i = mem8[SLOT_LOOP_INDEX];
    let y = 0x00;
    if (mem8[(SEG_SPREAD_A_LO + i) & 0xff] !== 0) y = mem8[u16(POTMARK_WORD_INDEX + i)];
    const a = mem8[u16(NIBBLE_GLYPH_TABLE + y)];
    const x = mem8[u16(NIBBLE_GLYPH_TABLE_HI + y)];
    emitVectorWord(m, a, x); // (m, a, x)
    mem8[SLOT_LOOP_INDEX] = mem8[SLOT_LOOP_INDEX] - 1;
  } while ((mem8[SLOT_LOOP_INDEX] & 0x80) === 0);

  // final mark, then tail-delegate to the colour-pair emitter with the SPINNER_ACCUM-indexed pair.
  emitScaledCoordinateRecord(m, 0x30, 0xac); // (m, a=0x30, x=0xac)
  const y50 = mem8[SPINNER_ACCUM];
  const aFin = mem8[u16(COLOR_PAIR_HI + y50)];
  const xFin = mem8[u16(COLOR_PAIR_LO + y50)];
  return emitKeyedScaledCoordinateRecord(m, 0xc0, aFin, xFin); // (m, y=0xc0, a=colour_hi[SPINNER_ACCUM], x=colour_lo[SPINNER_ACCUM])
}
