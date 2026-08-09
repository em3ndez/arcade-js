// SPDX-License-Identifier: GPL-3.0-only
/** loc_4cc3 — try to file the active player's finished score into the five-entry high-score board.
 * The standing records are read top (highest) first; the new score is compared against each until
 * the first one it is NOT below, which is where it belongs. The records beneath that slot slide
 * down one place, the new score is written into the freed slot with its three name cells set to a
 * blank sentinel, the record's initial-glyph row pointer is looked up from the byte the copy
 * uncovered, and the rank column is renumbered top to bottom. A score that beats none is dropped.
 * LIVE-OUT: the board, the two saved pointers, and carry — clear when filed, set when dropped. */

import { isScoreBelow } from "./isScoreBelow.js";
import { fetchTableByte } from "./fetchTableByte.js";

const ACTIVE_PLAYER = 0xad32;
const P1_SCORE = 0xad35;
const P2_SCORE = 0xad38;

const STANDING_SCORE = 0xab0b; // most-significant score cell of the top record
const RECORD_COUNT = 0x05;
const RECORD_STRIDE = 0x08;

const RANK_COLUMN = 0xab08; // rank cell of the top record
const SLIDE_SRC = 0xab27; // last cell of the record above the tail
const BOARD_END = 0xab2f; // last cell of the bottom record

const NAME_SENTINEL = 0xf1;
const SLOT_PTR = 0xa991;
const GLYPH_ROW_TABLE = 0xa531;
const GLYPH_ROW_PTR = 0xa993;

export function loc_4cc3(m) {
  const { regs, mem } = m;

  regs.hl = STANDING_SCORE;
  regs.b = RECORD_COUNT;
  regs.a = mem.read8(ACTIVE_PLAYER);
  regs.and(regs.a);
  regs.de = regs.fZ ? P1_SCORE : P2_SCORE;

  let savedDe = regs.de;
  let filed = false;
  for (;;) {
    savedDe = regs.de;
    const savedHl = regs.hl;
    isScoreBelow(m);
    if (regs.fNC) { filed = true; break; } // not below -> this is the slot
    regs.de = savedDe;
    regs.hl = savedHl;
    regs.a = RECORD_STRIDE;
    fetchTableByte(m); // walk the standing pointer down one record
    if (regs.djnz() !== 0) continue;
    break;
  }

  if (!filed) { regs.scf(); return; } // beat nothing

  regs.b = regs.dec8(regs.b);
  if (regs.fZ) {
    regs.hl = BOARD_END; // slot is the bottom record; nothing to slide
  } else {
    regs.hl = SLIDE_SRC;
    regs.de = BOARD_END;
    regs.a = regs.b;
    regs.add(regs.a);
    regs.add(regs.a);
    regs.add(regs.a); // b records * 8 cells
    regs.c = regs.a;
    regs.b = 0x00;
    m.lddrAt(0x4cf4, 0x4cf6);
    regs.exDeHl();
  }

  for (let i = 0; i < 3; i++) {
    regs.hl = (regs.hl - 1) & 0xffff;
    mem.write8(regs.hl, NAME_SENTINEL);
  }
  mem.write16(SLOT_PTR, regs.hl);
  regs.hl = (regs.hl - 1) & 0xffff;
  regs.de = savedDe;
  regs.bc = 0x0003;
  regs.exDeHl();
  m.lddrAt(0x4d09, 0x4d0b); // copy the three score cells in

  regs.a = mem.read8(regs.de); // the rank the copy uncovered
  regs.hl = GLYPH_ROW_TABLE;
  regs.add(regs.a);
  fetchTableByte(m);
  mem.write16(GLYPH_ROW_PTR, regs.hl);

  regs.hl = RANK_COLUMN;
  regs.de = RECORD_STRIDE;
  regs.b = RECORD_COUNT;
  regs.xor(regs.a);
  for (;;) {
    mem.write8(regs.hl, regs.a);
    regs.addHl(regs.de);
    regs.a = regs.inc8(regs.a);
    if (regs.djnz() !== 0) continue;
    break;
  }

  regs.scf();
  regs.ccf(); // carry clear -> filed
}
