// SPDX-License-Identifier: GPL-3.0-only
import {
  PALETTE_RECORD_TABLE,
  PALETTE_COLOR_05, PALETTE_COLOR_06, PALETTE_COLOR_07, PALETTE_COLOR_0D, PALETTE_COLOR_0E, PALETTE_COLOR_0F,
} from "./names.js";

/**
 * loadPaletteRecordPair — read a 3-byte colour record indexed by X and fan it out into two
 * palette triples in a fixed permutation.
 *
 * Centipede's colours live in palette RAM at $1400-$140f [seen], read directly by the video
 * hardware (which is why writes here never show up in a CPU state diff). The ROM keeps a table
 * of 3-byte colour records at PALETTE_RECORD_TABLE ($2676); the playfield-reset path calls this
 * routine to install one record's colours before drawing anything. Each record fills TWO
 * three-cell palette triples — triple A at $1405-$1407 and triple B at $140d-$140f — but in a
 * deliberately permuted byte order. For a record [b0, b1, b2] the result is:
 *   triple A ($140f,$140e,$140d order of writes below → cells 05/06/07) = (b0, b2, b1)
 *   triple B (cells 0d/0e/0f)                                            = (b1, b2, b0)
 * i.e. b2 (the shared middle colour) lands in both $140e and $1406, b0 in $140f/$1405, b1 in $140d/$1407.
 *
 * ROM 0x… . Grounding: the six palette RAM cells are [seen]; the record fan-out permutation is
 * [code], read from behaviour. X selects the record; no register is meaningful on exit (all scratch).
 *
 * @param {Machine} m
 * @param {number} [x=m.regs.x] record index
 */
export function loadPaletteRecordPair(m, x = m.regs.x) {
  // Address the X-th record in the ROM colour table. Mask X to 8 bits so a wrapped
  // index matches the 6502's zero-page-style addressing exactly.
  const base = PALETTE_RECORD_TABLE + (x & 0xff);
  // Read the record's three colour bytes.
  const b0 = m.mem8[base];
  const b1 = m.mem8[base + 1];
  const b2 = m.mem8[base + 2];

  // Fan the three bytes into the six palette cells in the fixed permutation.
  // b2 is the shared middle colour -> both triples' middle cell ($140e and $1406).
  m.mem8[PALETTE_COLOR_0E] = b2;
  m.mem8[PALETTE_COLOR_06] = b2;
  // b0 -> triple B tail ($140f) and triple A head ($1405).
  m.mem8[PALETTE_COLOR_0F] = b0;
  m.mem8[PALETTE_COLOR_05] = b0;
  // b1 -> triple B head ($140d) and triple A tail ($1407).
  m.mem8[PALETTE_COLOR_0D] = b1;
  m.mem8[PALETTE_COLOR_07] = b1;
}
